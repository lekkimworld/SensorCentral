create type HTTP_CONTENTTYPE as ENUM (
    'FORM',
    'JSON'
);
alter table event_onsensorsample add column contenttype HTTP_CONTENTTYPE not null;

create table secret (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    userid  character varying(36) not null,
    name character varying(36) not null,
    value  character varying(1024) not null
);
alter table secret add constraint SECRET_NAME_UNIQUE_PER_USER UNIQUE (userid, name);
alter table secret ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;

alter table endpoint drop column bearerToken;

update DATABASE_VERSION set version=17;
