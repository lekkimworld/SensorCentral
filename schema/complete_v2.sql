create table database_version (version int not null);
insert into database_version (version) values (2);

create table house (id character varying(36) not null primary key, name character varying(128) not null);

create table device (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, notify integer not null default 1, muted_until timestamp without time zone);
alter table device add foreign key (houseid) references house (id) on delete cascade;

create table sensor (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, type character varying(64) not null default 'temp'::character varying, label character varying(128) not null default 'foo'::character varying);
alter table sensor add foreign key (deviceid) references device (id) on delete cascade;

create table sensor_data (id character varying(36) not null, dt timestamp with time zone not null, value real not null);
create index on sensor_data (dt desc);

insert into house (id, name) values ('1cd8038f-9ffa-47aa-88d1-1795f33e110f', 'Your House');
insert into device (id, name, houseid, notify, muted_until) values ('yourdevice_1', 'Your Device 1', '1cd8038f-9ffa-47aa-88d1-1795f33e110f', 1, null);
insert into device (id, name, houseid, notify, muted_until) values ('yourdevice_2', 'Your Device 2', '1cd8038f-9ffa-47aa-88d1-1795f33e110f', 0, null);
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_1-1', 'Your Sensor 1-1', 'yoursensor_1-1', 'temp', 'yourdevice_1');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_1-2', 'Your Sensor 1-2', 'yoursensor_1-2', 'hum', 'yourdevice_1');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_2-1', 'Your Sensor 2-1', 'yoursensor_2-1', 'temp', 'yourdevice_2');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_2-2', 'Your Sensor 2-2', 'yoursensor_2-2', 'hum', 'yourdevice_2');
insert into house (id, name) values ('2cd9038f-9ffa-47aa-88d1-1795f44e220d', 'My House');
insert into device (id, name, houseid, notify, muted_until) values ('mydevice_1', 'My Device 1', '2cd9038f-9ffa-47aa-88d1-1795f44e220d', 1, null);
insert into device (id, name, houseid, notify, muted_until) values ('mydevice_2', 'My Device 2', '2cd9038f-9ffa-47aa-88d1-1795f44e220d', 0, null);
insert into sensor (id,name,label,type,deviceid) values ('mysensor_1-1', 'My Sensor 1-1', 'mysensor_1-1', 'temp', 'mydevice_1');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_1-2', 'My Sensor 1-2', 'mysensor_1-2', 'hum', 'mydevice_1');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_2-1', 'My Sensor 2-1', 'mysensor_2-1', 'temp', 'mydevice_2');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_2-2', 'My Sensor 2-2', 'mysensor_2-2', 'hum', 'mydevice_2');
