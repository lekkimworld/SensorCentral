alter table SENSOR add column icon character varying(36);
update SENSOR set icon='thermometer-empty' where type='temp';
update SENSOR set icon='tint' where type='hum';
alter table SENSOR alter column icon set not null;

ALTER TYPE sensor_type RENAME TO sensor_type_old;
CREATE TYPE sensor_type AS ENUM('gauge', 'counter');
ALTER TABLE sensor ALTER COLUMN type TYPE sensor_type USING type::text::sensor_type;
DROP TYPE sensor_type_old;

update SENSOR set type='gauge';
alter table SENSOR alter column type set not null;

alter table sensor_data add column from_dt timestamp with time zone;

update DATABASE_VERSION set version=4;
