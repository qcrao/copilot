const DEFAULT_YEARS_BACK = 3;
const DEFAULT_DAILY_UPDATE_HOUR = 9;

export let yearsBack = DEFAULT_YEARS_BACK;
export let dailyUpdateHour = DEFAULT_DAILY_UPDATE_HOUR;

export function loadInitialSettings(extensionAPI: any) {
  const savedYearsBack = extensionAPI.settings.get("years-back");
  yearsBack = savedYearsBack ? parseInt(savedYearsBack) : DEFAULT_YEARS_BACK;

  const savedUpdateHour = extensionAPI.settings.get(
    "hour-to-open-last-year-today-page"
  );

  dailyUpdateHour = savedUpdateHour
    ? parseInt(savedUpdateHour)
    : DEFAULT_DAILY_UPDATE_HOUR;
}

export function initPanelConfig(extensionAPI: any) {
  return {
    tabTitle: "Last Year Today",
    settings: [
      {
        id: "years-back",
        name: "Years Back",
        description: `Number of years to look back (default: ${DEFAULT_YEARS_BACK}, max: 10)`,
        action: {
          type: "input",
          onChange: (evt: any) => {
            console.log("yearsBack onChange", evt);
            if (!evt?.target?.value) return;

            const value = parseInt(evt.target.value);
            yearsBack = isNaN(value)
              ? DEFAULT_YEARS_BACK
              : Math.min(Math.max(value, 1), 10);

            Promise.resolve(
              extensionAPI.settings.set("years-back", yearsBack.toString())
            ).then(() => {
              console.log("yearsBack settingsChanged to", yearsBack);
            });
          },
        },
      },
      {
        id: "hour-to-open-last-year-today-page",
        name: "Hour to Open Last Year Today Page",
        description: `Hour of the day to open Last Year Today page (0-23, default: ${DEFAULT_DAILY_UPDATE_HOUR})`,
        action: {
          type: "input",
          onChange: (evt: any) => {
            console.log("dailyUpdateHour onChange", evt);
            if (!evt?.target?.value) return;

            const value = parseInt(evt.target.value);
            dailyUpdateHour = isNaN(value)
              ? DEFAULT_DAILY_UPDATE_HOUR
              : Math.min(Math.max(value, 0), 23);

            Promise.resolve(
              extensionAPI.settings.set(
                "hour-to-open-last-year-today-page",
                dailyUpdateHour.toString()
              )
            ).then(() => {
              window.dispatchEvent(
                new CustomEvent(
                  "lastYearToday:hour-to-open-last-year-today-page:settingsChanged"
                )
              );
            });
          },
        },
      },
    ],
  };
}
