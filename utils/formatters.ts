import type { RecurrencePattern } from "~/types/tasks";

// utils/formatters.ts
export const formatRecurrencePattern = (pattern: RecurrencePattern): string => {
  switch (pattern.type) {
    case "daily":
      return `Every ${
        pattern.interval > 1 ? `${pattern.interval} days` : "day"
      }`;
    case "weekly":
      const days = pattern.days_of_week
        ?.map((day) =>
          day === "MO"
            ? "Monday"
            : day === "TU"
            ? "Tuesday"
            : day === "WE"
            ? "Wednesday"
            : day === "TH"
            ? "Thursday"
            : day === "FR"
            ? "Friday"
            : day === "SA"
            ? "Saturday"
            : "Sunday"
        )
        .join(", ");
      return `Every ${
        pattern.interval > 1 ? `${pattern.interval} weeks` : "week"
      } on ${days}`;
    case "monthly":
      return `Every ${
        pattern.interval > 1 ? `${pattern.interval} months` : "month"
      }`;
    case "monthly_by_weekday":
      const week =
        pattern.week_of_month === -1
          ? "last"
          : pattern.week_of_month === 1
          ? "first"
          : pattern.week_of_month === 2
          ? "second"
          : pattern.week_of_month === 3
          ? "third"
          : "fourth";
      return `The ${week} ${formatWeekday(pattern.weekday)} of every ${
        pattern.interval > 1 ? `${pattern.interval} months` : "month"
      }`;
    case "yearly":
      return `Every ${
        pattern.interval > 1 ? `${pattern.interval} years` : "year"
      }`;
    default:
      return "Custom schedule";
  }
};

const formatWeekday = (day?: string): string => {
  if (!day) return "";
  const days: Record<string, string> = {
    SU: "Sunday",
    MO: "Monday",
    TU: "Tuesday",
    WE: "Wednesday",
    TH: "Thursday",
    FR: "Friday",
    SA: "Saturday",
  };
  return days[day] || "";
};
