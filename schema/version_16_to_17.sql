delete from endpoint;
alter table endpoint drop column bearerToken;

alter table endpoint rename to callout_endpoint;

create table callout_secret (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    userid  character varying(36) not null,
    name character varying(36) not null,
    value  character varying(1024) not null
);
alter table callout_secret add constraint SECRET_NAME_UNIQUE_PER_USER UNIQUE (userid, name);
alter table callout_secret ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;

create type CALLOUT_AUTHENTICATOR_TEMPLATE as ENUM (
    'STATIC-BEARERTOKEN',
    'DATACLOUD-CLIENTCREDENTIALS'
);

create table callout_authenticator (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    userid  character varying(36) not null,
    name character varying(36) not null,
    endpointid character varying(36) not null,
    template CALLOUT_AUTHENTICATOR_TEMPLATE not null
);
alter table callout_authenticator add foreign key (endpointid) references callout_endpoint (id) on delete cascade;
alter table callout_authenticator add foreign key (userid) references login_user (id) on delete cascade;
alter table callout_authenticator add constraint CALLOUT_AUTHNAME_UNIQUE_PER_USER UNIQUE (userid, name);

create table callout_authenticator_replacement (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    name  character varying(36) not null,
    secretid character varying(36) not null,
    authenticatorid character varying(36) not null
);
alter table callout_authenticator_replacement add foreign key (secretid) references callout_secret (id) on delete cascade;
alter table callout_authenticator_replacement add foreign key (authenticatorid) references callout_authenticator (id) on delete cascade;
alter table callout_authenticator_replacement add constraint CALLOUT_AUTH_PLACEMENT_NAME_UNIQUE UNIQUE (authenticatorid, name);

create table callout (
    id character varying(36) not null primary key default uuid_generate_v4(), 
    userid  character varying(36) not null,
    name character varying(36) not null,
    endpointid character varying(36) not null,
    method HTTP_METHOD not null,
    authenticatorid character varying(36),
    path_template character varying(128) not null,
    body_template character varying(1024)
);
alter table callout add foreign key (authenticatorid) references callout_authenticator (id) on delete cascade;
alter table callout add foreign key (endpointid) references callout_endpoint (id) on delete cascade;
alter table callout add constraint CALLOUT_ENDPOINT_NAME_UNIQUE_PER_USER UNIQUE (userid, name);

create type HTTP_CONTENTTYPE as ENUM (
    'FORM',
    'JSON'
);

delete from event_onsensorsample;
alter table event_onsensorsample drop column endpointid;
alter table event_onsensorsample drop column method;
alter table event_onsensorsample drop column path;
alter table event_onsensorsample drop column body;



alter table event_onsensorsample add column calloutid character varying(36) not null;
alter table event_onsensorsample add foreign key (calloutid) references callout (id) on delete cascade;

update DATABASE_VERSION set version=17;
