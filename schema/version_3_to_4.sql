alter table SENSOR add column icon character varying(36);
update SENSOR set icon='thermometer-empty' where type='temp';
update SENSOR set icon='tint' where type='hum';
alter table SENSOR alter column icon set not null;

alter type SENSOR_TYPE add value 'gauge';
alter type SENSOR_TYPE add value 'counter';
update SENSOR set type = 'gauge';

delete from pg_enum where enumlabel='temp' and enumtypid = (select oid from pg_type where typname='sensor_type');
delete from pg_enum where enumlabel='hum' and enumtypid = (select oid from pg_type where typname='sensor_type');

alter table sensor_data add column from_dt timestamp with time zone;

update DATABASE_VERSION set version=4;
