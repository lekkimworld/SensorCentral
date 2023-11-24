create table login_oidc_mapping (
    userid character varying(36) not null, 
    provider character varying(36) not null, 
    sub character varying(128) not null,
    verified boolean not null default false
);
alter table login_oidc_mapping add foreign key (userid) references login_user(id);
alter table login_oidc_mapping add primary key (userid, provider);

insert into login_oidc_mapping (userid, provider, verified, sub) select id, 'google' as provider, true, google_sub from login_user;

alter table login_user drop column google_sub;
alter table LOGIN_USER drop constraint USER_EMAIL_UNIQUE;
alter table login_user alter column email drop not null;

update DATABASE_VERSION set version=14;
