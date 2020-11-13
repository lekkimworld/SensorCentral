create table USER_HOUSE_ACCESS (userId character varying(36) not null, houseId character varying(36) not null, is_default boolean default false not null);
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (houseId) REFERENCES HOUSE(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD PRIMARY KEY (userId, houseId);

update DATABASE_VERSION set version=8;
