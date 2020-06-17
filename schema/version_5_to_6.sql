create table SMARTME_SUBSCRIPTION (clientId character varying(36) not null primary key, sensorId character varying(128) not null, login_user_id character varying(36) not null, username character varying(128) not null, password character varying(128) not null);
alter table SMARTME_SUBSCRIPTION add foreign key (login_user_id) references LOGIN_USER (id) on delete cascade;
alter table smartme_subscription add foreign key (sensorid) references SENSOR (id) on delete cascade;

alter type SENSOR_TYPE add value 'delta';
update sensor set type='delta' where type='counter';

update DATABASE_VERSION set version=6;
