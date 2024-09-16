create table jwt_issuers (
    id character varying(36) not null primary key default uuid_generate_v4(),
    houseid character varying(36) not null,
    issuer character varying(256) not null,
    public_key character varying(5120) not null
);
alter table jwt_issuers ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;

update DATABASE_VERSION set version=16;
