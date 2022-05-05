CREATE TABLE POWERMETER_SUBSCRIPTION (houseid character varying(36) not null, sensorid character varying(36) not null, frequency int not null, ciphertext character varying(256) not null);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD PRIMARY KEY (houseid, sensorid);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (sensorid) REFERENCES SENSOR(id) ON DELETE CASCADE;

update DATABASE_VERSION set version=11;
