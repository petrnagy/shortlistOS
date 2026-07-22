ALTER TABLE "shortlist_provider_request"
DROP CONSTRAINT "shortlist_provider_request_sourceJobId_shortlist_job_queue_id_fk";

ALTER TABLE "shortlist_provider_request"
ADD CONSTRAINT "shortlist_provider_request_sourceJobId_shortlist_job_queue_id_fk"
FOREIGN KEY ("sourceJobId") REFERENCES "public"."shortlist_job_queue"("id")
ON DELETE cascade ON UPDATE no action;
