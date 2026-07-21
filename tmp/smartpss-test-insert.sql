INSERT INTO smartpss_events.AttendanceRecordInfo (
  PersonID, PersonName, PerSonCardNo, AttendanceDateTime, AttendanceState, AttendanceMethod,
  DeviceIPAddress, DeviceName, SnapshotsPath, Handler, AttendanceUtcTime, Remarks
) VALUES (
  'TEST001', 'Prueba Suite', 'CARD1',
  UNIX_TIMESTAMP(NOW()) * 1000,
  0, 3,
  '192.168.99.50', 'Camara Entrada',
  '', '',
  UNIX_TIMESTAMP(UTC_TIMESTAMP()) * 1000,
  'evento de prueba Suite'
);
SELECT PersonID, PersonName, AttendanceDateTime, AttendanceState, DeviceName
FROM smartpss_events.AttendanceRecordInfo;
