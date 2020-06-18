
insert into LOGIN_USER (id, email,fn,ln) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'jane@example.com','Jane','Doe');

insert into house (id, name) values ('2cd9038f-9ffa-47aa-88d1-1795f44e220d', 'My House');
insert into device (id, name, houseid) values ('mydevice_1', 'My Device 1', '2cd9038f-9ffa-47aa-88d1-1795f44e220d');
insert into device (id, name, houseid) values ('mydevice_2', 'My Device 2', '2cd9038f-9ffa-47aa-88d1-1795f44e220d');
insert into device (id, name, houseid, active) values ('mydevice_3', 'My Device 3', '2cd9038f-9ffa-47aa-88d1-1795f44e220d', false);
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_1-1', 'My Sensor 1-1', 'mysensor_1-1', 'gauge', 'thermometer-empty', 'mydevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_1-2', 'My Sensor 1-2', 'mysensor_1-2', 'gauge', 'tint', 'mydevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_2-1', 'My Sensor 2-1', 'mysensor_2-1', 'gauge', 'thermometer-empty', 'mydevice_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_2-2', 'My Sensor 2-2', 'mysensor_2-2', 'gauge', 'tint', 'mydevice_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_3-1', 'My Delta Sensor 3-1', 'mycounter_3-1', 'delta', 'battery-4', 'mydevice_3');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_5-1', 'My Gauge Sensor 5-1', 'mycounter_5-1', 'gauge', 'thermometer-empty', 'mydevice_3');

insert into device_watchdog (userId, deviceId, notify, muted_until) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'mydevice_2', 'yes', null);
insert into device_watchdog (userId, deviceId, notify, muted_until) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'mydevice_3', 'muted', current_timestamp + interval '7 days');

insert into house (id, name) values ('1cd8038f-9ffa-47aa-88d1-1795f33e110f', 'Your House');
insert into device (id, name, houseid) values ('yourdevice_1', 'Your Device 1', '1cd8038f-9ffa-47aa-88d1-1795f33e110f');
insert into device (id, name, houseid) values ('yourdevice_2', 'Your Device 2', '1cd8038f-9ffa-47aa-88d1-1795f33e110f');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_1-1', 'Your Sensor 1-1', 'yoursensor_1-1', 'gauge', 'thermometer-empty', 'yourdevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_1-2', 'Your Sensor 1-2', 'yoursensor_1-2', 'gauge', 'tint', 'yourdevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_2-1', 'Your Sensor 2-1', 'yoursensor_2-1', 'gauge', 'thermometer-empty', 'yourdevice_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_2-2', 'Your Sensor 2-2', 'yoursensor_2-2', 'gauge', 'tint', 'yourdevice_2');

insert into sensor (id,name,label,type,icon,deviceid) values ('94f7a0f4-d85b-4815-9c77-833be7c28779', 'My Smartme 4-1', 'mysmartme_4-1', 'counter', 'battery-4', 'mydevice_3');
insert into SMARTME_SUBSCRIPTION (clientId, sensorId, username, password, login_user_id) values ('smartme-client-1', '94f7a0f4-d85b-4815-9c77-833be7c28779', 'fUG4caskWKnZ6US1jjJ1u6Yw5hSlnTliNjqhVrOoZ13hVojkNl7hoQZtXtziwGlnixVVxA==', 'Og5j6dC4I/5Zsui7+JJYcLEJSKAqdE+oskgZ63E5GC46N0p4f5AC0AYQyk92A2zC/nJFHg==', '8cd0149f-9ffa-47aa-88d1-1795f55e330f');
