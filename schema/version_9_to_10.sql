alter table POWERMETER_DATA alter column CurrentPhaseL1  DROP NOT NULL;
alter table POWERMETER_DATA alter column CurrentPhaseL2  DROP NOT NULL;
alter table POWERMETER_DATA alter column CurrentPhaseL3  DROP NOT NULL;
alter table POWERMETER_DATA alter column VoltagePhaseL1  DROP NOT NULL;
alter table POWERMETER_DATA alter column VoltagePhaseL2  DROP NOT NULL;
alter table POWERMETER_DATA alter column VoltagePhaseL3  DROP NOT NULL;

update DATABASE_VERSION set version=10;
