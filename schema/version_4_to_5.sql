alter table DEVICE add column active boolean not null default true;

update DATABASE_VERSION set version=5;
