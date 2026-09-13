ALTER TABLE requests DROP CONSTRAINT requests_status_check;
UPDATE requests SET status='submitted' WHERE status='new';
UPDATE request_events SET status='submitted' WHERE status='new';
ALTER TABLE requests ADD CONSTRAINT requests_status_check
 CHECK(status IN ('draft','submitted','in_progress','waiting','closed'));
