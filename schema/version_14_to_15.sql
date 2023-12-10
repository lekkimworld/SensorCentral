CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table endpoint (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    name character varying(128) not null,
    userId character varying(36) not null, 
    baseurl character varying(128) not null,
    bearertoken character varying(1024)
);
alter table endpoint ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;

create type HTTP_METHOD as ENUM (
    'GET',
    'POST'
);

create table event_onsensorsample (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    sensorid character varying(36) not null,
    userid  character varying(36) not null,
    endpointid character varying(36) not null,
    method HTTP_METHOD not null,
    path character varying(128),
    body character varying(1024)
);
alter table event_onsensorsample ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table event_onsensorsample ADD FOREIGN KEY (sensorid) REFERENCES sensor(id) ON DELETE CASCADE;
alter table event_onsensorsample ADD FOREIGN KEY (endpointid) REFERENCES endpoint(id) ON DELETE CASCADE;

update DATABASE_VERSION set version=15;
