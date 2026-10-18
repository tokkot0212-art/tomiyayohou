// 富谷の洗濯日和 ウィジェット（iPhoneアプリ「Scriptable」用）
// 気象庁「宮城県東部」の予報から、朝6時〜夕方18時に外干しできるかを ○・△・× で表示します。
// ○ 降水確率がどちらも10%以下で、予報文に「雨」「雪」なし
// △ 降水確率20〜40%、または「にわか雨」「一時雨」などの文言あり
// × 降水確率50%以上、または雨・雪が主な天気

const SRC = "https://www.jma.go.jp/bosai/forecast/data/forecast/040000.json";
const AREA = "040010"; // 宮城県東部（富谷市を含む）
const APP = "https://tokkot0212-art.github.io/tomiyayohou/";

const STYLE = {
  ok:  { mark: "○", text: "外干しOK",   bg: "#1f8a5b" },
  mid: { mark: "△", text: "にわか雨注意", bg: "#b8800f" },
  ng:  { mark: "×", text: "部屋干し",    bg: "#b8434a" },
  na:  { mark: "?", text: "予報なし",    bg: "#5f707c" },
};

function parse(json) {
  const ts = json[0].timeSeries;
  const w = ts[0], wa = w.areas.find(a => a.area.code === AREA) || w.areas[0];
  const days = w.timeDefines.map((t, i) => ({
    date: t.slice(0, 10),
    weather: (wa.weathers?.[i] || "").replace(/　/g, " "),
    weatherCode: wa.weatherCodes?.[i] || "",
    pop06: null, pop12: null,
  }));
  const p = ts[1], pa = p.areas.find(a => a.area.code === AREA) || p.areas[0];
  p.timeDefines.forEach((t, i) => {
    const d = days.find(x => x.date === t.slice(0, 10)); if (!d) return;
    const h = t.slice(11, 13), v = pa.pops[i]; if (v === "" || v == null) return;
    if (h === "06") d.pop06 = Number(v);
    if (h === "12") d.pop12 = Number(v);
  });
  return days;
}

function judge(d) {
  const p = [d.pop06, d.pop12].filter(v => typeof v === "number");
  if (!p.length) return "na";
  const max = Math.max(...p);
  const c = String(d.weatherCode || "")[0];
  if (c === "3" || c === "4" || max >= 50) return "ng";
  if (max <= 10 && !/雨|雪/.test(d.weather || "")) return "ok";
  return "mid";
}

function ymd(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

async function loadDays() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), "tomiya-jma.json");
  try {
    const json = await new Request(SRC).loadJSON();
    fm.writeString(cache, JSON.stringify(json));
    return { days: parse(json), offline: false };
  } catch (e) {
    if (fm.fileExists(cache)) return { days: parse(JSON.parse(fm.readString(cache))), offline: true };
    return { days: [], offline: true };
  }
}

const { days, offline } = await loadDays();
const now = new Date();
const today = ymd(now);
let i = days.findIndex(d => d.date === today);
if (i < 0) i = 0;
// 18時を過ぎたら、または今日の日中枠がもう発表されていなければ明日を表示
if (days[i + 1] && (now.getHours() >= 18 || (days[i].pop06 == null && days[i].pop12 == null))) i++;
const day = days[i];
const v = day ? judge(day) : "na";
const s = STYLE[v];

const w = new ListWidget();
w.backgroundColor = new Color(s.bg);
w.url = APP;
w.setPadding(12, 14, 12, 14);

const white = Color.white();
if (day) {
  const [, m, d] = day.date.split("-").map(Number);
  const label = day.date === today ? "今日" : "明日";
  const top = w.addText(`${label} ${m}/${d} 洗濯${offline ? "・圏外" : ""}`);
  top.font = Font.semiboldSystemFont(12);
  top.textColor = white; top.textOpacity = 0.85;
} else {
  const top = w.addText("富谷の洗濯");
  top.font = Font.semiboldSystemFont(12); top.textColor = white;
}

w.addSpacer();
const mark = w.addText(s.mark);
mark.font = Font.boldRoundedSystemFont(58);
mark.textColor = white;
mark.minimumScaleFactor = 0.6;

const txt = w.addText(s.text);
txt.font = Font.boldSystemFont(16);
txt.textColor = white;
txt.minimumScaleFactor = 0.7;
txt.lineLimit = 1;

w.addSpacer(2);
const pop = w.addText(day ? `降水 ${day.pop06 ?? "–"}% / ${day.pop12 ?? "–"}%` : "電波の良い所で再表示");
pop.font = Font.systemFont(11);
pop.textColor = white; pop.textOpacity = 0.85;

w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000); // 約1時間ごとに更新

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
