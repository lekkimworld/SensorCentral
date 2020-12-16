alter table device_watchdog alter column muted_until type timestamp with time zone;

update DATABASE_VERSION set version=9;
