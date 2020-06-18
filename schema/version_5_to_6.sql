create table SMARTME_SUBSCRIPTION (clientId character varying(36) not null primary key, sensorId character varying(128) not null, login_user_id character varying(36) not null, username character varying(128) not null, password character varying(128) not null);
alter table SMARTME_SUBSCRIPTION add foreign key (login_user_id) references LOGIN_USER (id) on delete cascade;
alter table smartme_subscription add foreign key (sensorid) references SENSOR (id) on delete cascade;

alter type SENSOR_TYPE add value 'delta';
update sensor set type='delta' where type='counter';

create table POWERMETER_DATA (id character varying(36) not null, dt timestamp with time zone not null, ActiveEnergyTotalExport real not null, ActiveEnergyTotalImport real not null, ActivePowerPhaseL1 real, ActivePowerPhaseL2 real, ActivePowerPhaseL3 real, ActivePowerTotal real not null, CurrentPhaseL1 real not null, CurrentPhaseL2 real not null, CurrentPhaseL3 real not null, VoltagePhaseL1 real not null, VoltagePhaseL2 real not null, VoltagePhaseL3 real not null);
create index on POWERMETER_DATA (dt desc);

update DATABASE_VERSION set version=6;
