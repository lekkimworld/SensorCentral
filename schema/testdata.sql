insert into LOGIN_USER (id, google_sub, email,fn,ln) values ('mikkel_user_id', '110104280470632570110', 'lekkim@heisterberg.dk','Mikkel','Flindt Heisterberg');
insert into house (id, name) values ('mikkel_house_1', 'My House');
insert into device (id, name, houseid) values ('mydevice_1', 'My Device 1', 'mikkel_house_1');
insert into device (id, name, houseid) values ('mydevice_2', 'My Device 2', 'mikkel_house_1');
insert into device (id, name, houseid, active) values ('mydevice_3', 'My Device 3', 'mikkel_house_1', false);
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_1-1', 'My Sensor 1-1', 'mysensor_1-1', 'gauge', 'thermometer-empty', 'mydevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_1-2', 'My Sensor 1-2', 'mysensor_1-2', 'gauge', 'tint', 'mydevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_2-1', 'My Sensor 2-1', 'mysensor_2-1', 'gauge', 'thermometer-empty', 'mydevice_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_2-2', 'My Sensor 2-2', 'mysensor_2-2', 'gauge', 'tint', 'mydevice_2');
insert into sensor (id,name,label,type,icon,scalefactor,deviceid) values ('mysensor_3-1', 'My Delta Sensor 3-1', 'mycounter_3-1', 'delta', 'battery-4', 0.001, 'mydevice_3');
insert into sensor (id,name,label,type,icon,scalefactor,deviceid) values ('mysensor_3-2', 'My Delta Sensor 3-2', 'mycounter_3-2', 'delta', 'battery-4', 0.001, 'mydevice_3');
insert into sensor (id,name,label,type,icon,deviceid) values ('mysensor_5-1', 'My Gauge Sensor 5-1', 'mycounter_5-1', 'gauge', 'thermometer-empty', 'mydevice_3');
insert into device_watchdog (userId, deviceId, notify, muted_until) values ('mikkel_user_id', 'mydevice_2', 'yes', null);
insert into device_watchdog (userId, deviceId, notify, muted_until) values ('mikkel_user_id', 'mydevice_3', 'muted', current_timestamp + interval '7 days');
insert into USER_HOUSE_ACCESS (userId, houseId, is_default, owner) values ('mikkel_user_id', 'mikkel_house_1', true, true);

insert into house (id, name) values ('mikkel_house_2', 'Your House');
insert into device (id, name, houseid) values ('yourdevice_1', 'Your Device 1', 'mikkel_house_2');
insert into device (id, name, houseid) values ('yourdevice_2', 'Your Device 2', 'mikkel_house_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_1-1', 'Your Sensor 1-1', 'yoursensor_1-1', 'gauge', 'thermometer-empty', 'yourdevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_1-2', 'Your Sensor 1-2', 'yoursensor_1-2', 'gauge', 'tint', 'yourdevice_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_2-1', 'Your Sensor 2-1', 'yoursensor_2-1', 'gauge', 'thermometer-empty', 'yourdevice_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('yoursensor_2-2', 'Your Sensor 2-2', 'yoursensor_2-2', 'gauge', 'tint', 'yourdevice_2');
insert into sensor (id,name,label,type,icon,scalefactor,deviceid) values ('94f7a0f4-d85b-4815-9c77-833be7c28779', 'My Smartme 4-1', 'mysmartme_4-1', 'counter', 'battery-4', 0.002, 'mydevice_3');
insert into USER_HOUSE_ACCESS (userId, houseId, is_default, owner) values ('mikkel_user_id', 'mikkel_house_2', false, true);


insert into LOGIN_USER (id, email,fn,ln) values ('jane_user_id', 'jane@example.com','Jane','Doe');
insert into house (id, name) values ('jane_house_1', 'Jane''s House 1');
insert into device (id, name, houseid) values ('jane_device_1', 'Jane Device 1', 'jane_house_1');
insert into device (id, name, houseid) values ('jane_device_2', 'Jane Device 2', 'jane_house_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('jane_sensor_1-1', 'Jane Sensor 1-1', 'jane_sensor_1-1', 'gauge', 'thermometer-empty', 'jane_device_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('jane_sensor_1-2', 'Jane Sensor 1-2', 'jane_sensor_1-2', 'gauge', 'thermometer-empty', 'jane_device_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('jane_sensor_2-1', 'Jane Sensor 2-1', 'jane_sensor_2-1', 'gauge', 'thermometer-empty', 'jane_device_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('jane_sensor_2-2', 'Jane Sensor 2-2', 'jane_sensor_2-2', 'gauge', 'thermometer-empty', 'jane_device_2');
insert into USER_HOUSE_ACCESS (userId, houseId, is_default, owner) values ('jane_user_id', 'jane_house_1', true, true);
insert into USER_HOUSE_ACCESS (userId, houseId) values ('mikkel_user_id', 'jane_house_1');

insert into LOGIN_USER (id, email,fn,ln) values ('john_user_id', 'john@example.com','John','Doe');
insert into house (id, name) values ('john_house_1', 'John''s House 1');
insert into device (id, name, houseid) values ('john_device_1', 'John Device 1', 'john_house_1');
insert into device (id, name, houseid) values ('john_device_2', 'John Device 2', 'john_house_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('john_sensor_1-1', 'John Sensor 1-1', 'john_sensor_1-1', 'gauge', 'thermometer-empty', 'john_device_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('john_sensor_1-2', 'John Sensor 1-2', 'john_sensor_1-2', 'gauge', 'thermometer-empty', 'john_device_1');
insert into sensor (id,name,label,type,icon,deviceid) values ('john_sensor_2-1', 'John Sensor 2-1', 'john_sensor_2-1', 'gauge', 'thermometer-empty', 'john_device_2');
insert into sensor (id,name,label,type,icon,deviceid) values ('john_sensor_2-2', 'John Sensor 2-2', 'john_sensor_2-2', 'gauge', 'thermometer-empty', 'john_device_2');
insert into USER_HOUSE_ACCESS (userId, houseId, is_default, owner) values ('john_user_id', 'john_house_1', true, true);
insert into USER_HOUSE_ACCESS (userId, houseId) values ('mikkel_user_id', 'john_house_1');
