create table database_version (version int not null);
insert into database_version (version) values (2);

create table house (id character varying(36) not null primary key, name character varying(128) not null);

create table device (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, notify integer not null default 1, muted_until timestamp without time zone);
alter table device add foreign key (houseid) references house (id) on delete cascade;

create table sensor (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, type character varying(64) not null default 'temp'::character varying, label character varying(128) not null default 'foo'::character varying);
alter table sensor add foreign key (deviceid) references device (id) on delete cascade;

create table sensor_data (id character varying(36) not null, dt timestamp with time zone not null, value real not null);
create index on sensor_data (dt desc);
