ALTER TABLE "card" DROP COLUMN "shortlist_salaryPercentileUS";--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "shortlist_salaryPercentileEU";--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "shortlist_salaryPercentileAPAC";--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "shortlist_salaryPercentileUK";--> statement-breakpoint
ALTER TABLE "card" DROP COLUMN "shortlist_salaryPercentileGlobal";--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryData" json;
