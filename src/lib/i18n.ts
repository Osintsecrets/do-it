export type Lang = "en" | "he";
export const t = (lang:Lang, key:string) => {
  const dict:any = {
    en: { welcome:"Welcome", install:"Install App", diary:"Diary", tools:"Tools", settings:"Settings", about:"About",
      offline:"Works offline", installable:"Installable", textOnly:"Text-only repo" },
    he: { welcome:"ברוך הבא", install:"התקן אפליקציה", diary:"יומן", tools:"כלים", settings:"הגדרות", about:"עלינו",
      offline:"פועל ללא אינטרנט", installable:"ניתן להתקנה", textOnly:"מאגר ללא קבצים בינאריים" }
  }; return (dict[lang]&&dict[lang][key]) || key;
};
