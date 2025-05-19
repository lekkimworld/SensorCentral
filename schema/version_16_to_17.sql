create type HTTP_CONTENTTYPE as ENUM (
    'FORM',
    'JSON'
);
alter table event_onsensorsample add column contenttype HTTP_CONTENTTYPE not null;

update DATABASE_VERSION set version=17;
