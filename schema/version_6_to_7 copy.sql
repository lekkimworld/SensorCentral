alter table sensor add column scalefactor real not null default 1;

update DATABASE_VERSION set version=7;
