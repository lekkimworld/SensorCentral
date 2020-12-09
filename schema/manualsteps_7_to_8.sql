>> Database
for each user grant access to houses
insert into user_house_access (houseid,userid,is_default,owner) values ('','',,);

insert into user_house_access (houseid,userid,is_default,owner) values ('15e0d390-4411-11ea-ad26-fdbeba5c13bb', '519fd600-89ef-11ea-bbcf-19c7982b4b8b', false, false);
insert into user_house_access (houseid,userid,is_default,owner) values ('b901c950-443c-11ea-add4-c105fe433949', '519fd600-89ef-11ea-bbcf-19c7982b4b8b', true, true);
insert into user_house_access (houseid,userid,is_default,owner) values ('a96e5650-1ab7-11eb-a5c0-a5392934e67d', '519fd600-89ef-11ea-bbcf-19c7982b4b8b', false, false);
insert into user_house_access (houseid,userid,is_default,owner) values ('15e0d390-4411-11ea-ad26-fdbeba5c13bb', '10b0fd60-89fc-11ea-a431-27a0c55c232a', false, true);
insert into user_house_access (houseid,userid,is_default,owner) values ('b901c950-443c-11ea-add4-c105fe433949', '10b0fd60-89fc-11ea-a431-27a0c55c232a', false, false);
insert into user_house_access (houseid,userid,is_default,owner) values ('a96e5650-1ab7-11eb-a5c0-a5392934e67d', '10b0fd60-89fc-11ea-a431-27a0c55c232a', true, true);

>> Environment vars
NODE_ENV=production
WHITELISTED_DEVICE_IDS
WHITELISTED_IMPERSONATION_ID
