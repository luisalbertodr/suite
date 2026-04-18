-- Oleada 2 legacy: resto de tablas del reporte ESTRUCTURA (incluye TMP, accesos, bancos, baremos, etc.)
-- Generado por scripts/build_legacy_wave2_migration.py

CREATE SCHEMA IF NOT EXISTS legacy;

COMMENT ON SCHEMA legacy IS 'Volcado fiel Dunasoft/Style (oleada 1 + 2, resto tablas DBF). No exponer a API publica sin revision.';

REVOKE ALL ON SCHEMA legacy FROM PUBLIC;
GRANT USAGE ON SCHEMA legacy TO postgres;
GRANT USAGE ON SCHEMA legacy TO service_role;

CREATE TABLE IF NOT EXISTS legacy.accesos (
  codgru text,
  codpan text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_accesos_imported_at ON legacy.accesos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.agendaart (
  codage text,
  codart text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_agendaart_imported_at ON legacy.agendaart (imported_at);

CREATE TABLE IF NOT EXISTS legacy.albcab (
  seralb text,
  ejealb text,
  numalb text,
  fecha text,
  hora text,
  codcli text,
  obser text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  total text,
  lineas text,
  impresa text,
  dtopp text,
  dto1 text,
  dtocam text,
  dtoaso text,
  dtomav text,
  dtovar text,
  anulada text,
  puntos text,
  codemp text,
  foto1 text,
  foto2 text,
  enviar text,
  sexo text,
  idconcepto text,
  codboncli1 text,
  codboncli2 text,
  impbono1 text,
  impbono2 text,
  mesa text,
  comensales text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  numprerel text,
  numfacrel text,
  ntickets text,
  codalu text,
  ticeval text,
  contab text,
  fechorfin text,
  facimp text,
  plato text,
  facturado text,
  estado text,
  impcob text,
  siniva text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_albcab_imported_at ON legacy.albcab (imported_at);

CREATE TABLE IF NOT EXISTS legacy.alblin (
  seralb text,
  ejealb text,
  numalb text,
  linalb text,
  codart text,
  desart text,
  tipfam1 text,
  precio text,
  coste text,
  cant text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  codemp text,
  comision text,
  codboncli text,
  codbon text,
  estado text,
  hora text,
  impreso text,
  plato text,
  poremps text,
  codemp2 text,
  comision2 text,
  creditos text,
  codalu text,
  idtalla text,
  idcolor text,
  pvpcom text,
  pulsos text,
  energia text,
  foto text,
  numser text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_alblin_imported_at ON legacy.alblin (imported_at);

CREATE TABLE IF NOT EXISTS legacy.albproc (
  seralb text,
  ejealb text,
  numalb text,
  fecalb text,
  serped text,
  ejeped text,
  numped text,
  sualb text,
  codpro text,
  obsalb text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  totalb text,
  lineas text,
  impresa text,
  forpag text,
  fijo1 text,
  fijo2 text,
  fijo3 text,
  numpag text,
  pripag text,
  entpag text,
  dtopp text,
  dto1 text,
  facturado text,
  enviar text,
  idconcepto text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  codban text,
  cueban text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_albproc_imported_at ON legacy.albproc (imported_at);

CREATE TABLE IF NOT EXISTS legacy.albprol (
  seralb text,
  ejealb text,
  numalb text,
  linalb text,
  serped text,
  ejeped text,
  numped text,
  linped text,
  codart text,
  desart text,
  preven text,
  canser text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  idtalla text,
  idcolor text,
  numser text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_albprol_imported_at ON legacy.albprol (imported_at);

CREATE TABLE IF NOT EXISTS legacy.altpeso (
  altura text,
  peso text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_altpeso_imported_at ON legacy.altpeso (imported_at);

CREATE TABLE IF NOT EXISTS legacy.alumnos (
  codalu text,
  nomalu text,
  ape1alu text,
  mail text,
  dnialu text,
  diralu text,
  codposalu text,
  pobalu text,
  proalu text,
  asenta text,
  pais text,
  tel1alu text,
  tel2alu text,
  tel3alu text,
  foto text,
  obsalu text,
  obsoleto text,
  fecbaja text,
  fecalta text,
  codalu2 text,
  idgrualu text,
  nosms text,
  noemail text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_alumnos_imported_at ON legacy.alumnos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.bancos (
  codban text,
  nomban text,
  dirban text,
  codposban text,
  pobban text,
  proban text,
  asenta text,
  pais text,
  tel1ban text,
  tel2ban text,
  tel3ban text,
  email text,
  obsban text,
  codcue text,
  entidad text,
  oficina text,
  cuenta text,
  iban text,
  swift text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_bancos_imported_at ON legacy.bancos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.baremos (
  codbar text,
  desbar text,
  tipo text,
  obsbar text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_baremos_imported_at ON legacy.baremos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.blog (
  idblog text,
  fecblog text,
  titblog text,
  obsblog text,
  obscorblog text,
  foto text,
  fecini text,
  fecfin text,
  enviarweb text,
  facebook text,
  facebookdt text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_blog_imported_at ON legacy.blog (imported_at);

CREATE TABLE IF NOT EXISTS legacy.bonos (
  codbon text,
  desbon text,
  diamesany text,
  caduca text,
  foto text,
  obsoleto text,
  importe text,
  dto text,
  obsbon text,
  servicios text,
  productos text,
  nocaduca text,
  ntickets text,
  tipo text,
  enviar text,
  pvpb text,
  pvpc text,
  pvpd text,
  pvpe text,
  config text,
  noautonum text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_bonos_imported_at ON legacy.bonos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.bonosart (
  codbon text,
  codart text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_bonosart_imported_at ON legacy.bonosart (imported_at);

CREATE TABLE IF NOT EXISTS legacy.bonosfam (
  codbon text,
  codfam1 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_bonosfam_imported_at ON legacy.bonosfam (imported_at);

CREATE TABLE IF NOT EXISTS legacy.catemp (
  idcatemp text,
  descatemp text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_catemp_imported_at ON legacy.catemp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.cbarras (
  codart text,
  codartdos text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_cbarras_imported_at ON legacy.cbarras (imported_at);

CREATE TABLE IF NOT EXISTS legacy.ciecab (
  numcie text,
  feccie text,
  horcie text,
  codemp text,
  impcie text,
  cerrado text,
  obscie text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_ciecab_imported_at ON legacy.ciecab (imported_at);

CREATE TABLE IF NOT EXISTS legacy.cieentsal (
  numdoc text,
  desdoc text,
  fecdoc text,
  hordoc text,
  codemp text,
  tipdoc text,
  forpag text,
  impdoc text,
  numcie text,
  obsdoc text,
  codtipmov text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_cieentsal_imported_at ON legacy.cieentsal (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clicav (
  idclicav text,
  codcli text,
  fecha text,
  area text,
  potencia text,
  programa text,
  altura text,
  medida1 text,
  medida2 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clicav_imported_at ON legacy.clicav (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clicon (
  idclicon text,
  codcli text,
  idconsen text,
  fecha text,
  firmado text,
  ruta text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clicon_imported_at ON legacy.clicon (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clilopd (
  codcli text,
  dato1 text,
  dato2 text,
  dato3 text,
  dato4 text,
  dato5 text,
  dato6 text,
  dato7 text,
  dato8 text,
  dato9 text,
  dato10 text,
  dato11 text,
  dato12 text,
  dato13 text,
  dato14 text,
  dato15 text,
  dato16 text,
  dato17 text,
  dato18 text,
  dato19 text,
  dato20 text,
  dato21 text,
  dato22 text,
  dato23 text,
  dato24 text,
  dato25 text,
  dato26 text,
  dato27 text,
  dato28 text,
  dato29 text,
  dato30 text,
  dato31 text,
  dato32 text,
  dato33 text,
  dato34 text,
  dato35 text,
  dato36 text,
  dato37 text,
  dato38 text,
  dato39 text,
  dato40 text,
  dato41 text,
  dato42 text,
  dato43 text,
  dato44 text,
  dato45 text,
  dato46 text,
  dato47 text,
  dato48 text,
  dato49 text,
  dato50 text,
  dato51 text,
  dato52 text,
  dato501 text,
  dato502 text,
  dato503 text,
  dato504 text,
  dato505 text,
  dato506 text,
  dato507 text,
  dato508 text,
  dato509 text,
  dato510 text,
  dato511 text,
  dato512 text,
  dato513 text,
  dato514 text,
  dato515 text,
  dato516 text,
  dato517 text,
  dato518 text,
  dato519 text,
  dato520 text,
  dato601 text,
  dato602 text,
  dato603 text,
  dato604 text,
  dato605 text,
  dato606 text,
  dato607 text,
  dato608 text,
  dato609 text,
  dato610 text,
  dato611 text,
  dato612 text,
  dato613 text,
  dato614 text,
  dato615 text,
  dato616 text,
  dato617 text,
  dato618 text,
  dato619 text,
  dato620 text,
  dato621 text,
  dato622 text,
  dato623 text,
  dato624 text,
  dato625 text,
  dato626 text,
  dato627 text,
  dato701 text,
  dato702 text,
  dato703 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clilopd_imported_at ON legacy.clilopd (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clipel (
  idclipel text,
  codcli text,
  fecha text,
  prouticp text,
  formulasp text,
  tecnicap text,
  tieexpp text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clipel_imported_at ON legacy.clipel (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clipeso (
  codcli text,
  fecha text,
  pesbas text,
  masgra text,
  excmas text,
  agua text,
  peside text,
  gracor text,
  masgraopt text,
  matnogra text,
  excgra text,
  tobillo text,
  muslo text,
  cintura text,
  pechoalt text,
  gemelos text,
  cadera text,
  abdomen text,
  rodilla text,
  barriga text,
  pechocon text,
  obspes text,
  imc text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clipeso_imported_at ON legacy.clipeso (imported_at);

CREATE TABLE IF NOT EXISTS legacy.cliseslas (
  idclises text,
  codcli text,
  fecha text,
  precio text,
  zona text,
  tippie text,
  grapig text,
  grovel text,
  energia text,
  numdis text,
  sistema text,
  opera text,
  obser text,
  energia2 text,
  sesion text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_cliseslas_imported_at ON legacy.cliseslas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.clitra (
  idclitra text,
  codcli text,
  fecini text,
  fecfin text,
  sesact text,
  sestot text,
  destra text,
  tecemp text,
  aparatos text,
  cosme text,
  apodom text,
  otros text,
  resultado text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_clitra_imported_at ON legacy.clitra (imported_at);

CREATE TABLE IF NOT EXISTS legacy.codpos (
  codpos text,
  poblacion text,
  provincia text,
  asenta text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_codpos_imported_at ON legacy.codpos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.colores (
  idcolor text,
  descolor text,
  color text,
  enviar text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_colores_imported_at ON legacy.colores (imported_at);

CREATE TABLE IF NOT EXISTS legacy.conceptos (
  idconcepto text,
  desconcep text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_conceptos_imported_at ON legacy.conceptos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.consen (
  idconsen text,
  desconsen text,
  obsconsen text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_consen_imported_at ON legacy.consen (imported_at);

CREATE TABLE IF NOT EXISTS legacy.curalu (
  idcurso text,
  codalu text,
  cureval text,
  obsalu text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_curalu_imported_at ON legacy.curalu (imported_at);

CREATE TABLE IF NOT EXISTS legacy.curasi (
  idcurso text,
  fecasi text,
  codalu text,
  asistencia text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_curasi_imported_at ON legacy.curasi (imported_at);

CREATE TABLE IF NOT EXISTS legacy.cureje (
  codcur text,
  idcurso text,
  descurso text,
  obscurso text,
  fecini text,
  fecfin text,
  precio text,
  obsoleto text,
  lunes text,
  martes text,
  miercoles text,
  jueves text,
  viernes text,
  sabado text,
  domingo text,
  dia1a text,
  dia1b text,
  dia1c text,
  dia1d text,
  dia2a text,
  dia2b text,
  dia2c text,
  dia2d text,
  dia3a text,
  dia3b text,
  dia3c text,
  dia3d text,
  dia4a text,
  dia4b text,
  dia4c text,
  dia4d text,
  dia5a text,
  dia5b text,
  dia5c text,
  dia5d text,
  dia6a text,
  dia6b text,
  dia6c text,
  dia6d text,
  dia7a text,
  dia7b text,
  dia7c text,
  dia7d text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_cureje_imported_at ON legacy.cureje (imported_at);

CREATE TABLE IF NOT EXISTS legacy.curprof (
  idcurso text,
  codprof text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_curprof_imported_at ON legacy.curprof (imported_at);

CREATE TABLE IF NOT EXISTS legacy.cursos (
  codcur text,
  descur text,
  obscur text,
  obsoleto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_cursos_imported_at ON legacy.cursos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.edadpeso (
  edad text,
  sexo text,
  correc text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_edadpeso_imported_at ON legacy.edadpeso (imported_at);

CREATE TABLE IF NOT EXISTS legacy.email (
  fecha text,
  mail text,
  tema text,
  texto text,
  adjuntos text,
  estado text,
  msgerror text,
  codcli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_email_imported_at ON legacy.email (imported_at);

CREATE TABLE IF NOT EXISTS legacy.empart (
  codemp text,
  codart text,
  comision text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_empart_imported_at ON legacy.empart (imported_at);

CREATE TABLE IF NOT EXISTS legacy.empfam (
  codemp text,
  codfam1 text,
  comision text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_empfam_imported_at ON legacy.empfam (imported_at);

CREATE TABLE IF NOT EXISTS legacy.empfest (
  codemp text,
  fecha text,
  desfec text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_empfest_imported_at ON legacy.empfest (imported_at);

CREATE TABLE IF NOT EXISTS legacy.faccabper (
  serfac text,
  numfac text,
  codcli text,
  obsfac text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  totfac text,
  lineas text,
  impresa text,
  forpag text,
  fijo1 text,
  fijo2 text,
  fijo3 text,
  numpag text,
  pripag text,
  entpag text,
  dtopp text,
  dto1 text,
  idconcepto text,
  codban text,
  cueban text,
  dtocam text,
  dtoaso text,
  dtomav text,
  dtovar text,
  anulada text,
  codemp text,
  comision text,
  obsfac2 text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  enero text,
  enero1 text,
  febrero text,
  febrero1 text,
  marzo text,
  marzo1 text,
  abril text,
  abril1 text,
  mayo text,
  mayo1 text,
  junio text,
  junio1 text,
  julio text,
  julio1 text,
  agosto text,
  agosto1 text,
  setiembre text,
  setiembre1 text,
  octubre text,
  octubre1 text,
  noviembre text,
  noviembre1 text,
  diciembre text,
  diciembre1 text,
  fecini text,
  fecfin text,
  codempalta text,
  suped text,
  iddir text,
  iban text,
  siniva text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_faccabper_imported_at ON legacy.faccabper (imported_at);

CREATE TABLE IF NOT EXISTS legacy.faccabtmp (
  idticket text,
  serfac text,
  ejefac text,
  numfac text,
  fecfac text,
  hora text,
  codcli text,
  codemp text,
  obsfac text,
  mesa text,
  comensales text,
  puntos text,
  puntosfac text,
  dtovar text,
  cierre text,
  lineas text,
  totfac text,
  cobrando text,
  plato text,
  codalu text,
  ticeval text,
  hash text,
  hash1 text,
  acuenta text,
  cert text,
  nocert text,
  folfis text,
  fecfolfis text,
  hashsat text,
  hash1sat text,
  nocertsat text,
  rutaqr text,
  horasaft text,
  enviadoand text,
  siniva text,
  puntosavi text,
  puntosres text,
  rfcsat text,
  leysat text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_faccabtmp_imported_at ON legacy.faccabtmp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.faclinper (
  numfac text,
  linfac text,
  codart text,
  desart text,
  tipfam1 text,
  codemp text,
  preven text,
  coste text,
  cant text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  codbon text,
  codboncli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_faclinper_imported_at ON legacy.faclinper (imported_at);

CREATE TABLE IF NOT EXISTS legacy.faclintmp (
  idticket text,
  linfac text,
  cant text,
  codart text,
  desart text,
  precio text,
  foto text,
  taniva text,
  codemp text,
  descuento text,
  subtot text,
  coste text,
  comision text,
  codboncli text,
  codbon text,
  estado text,
  impreso text,
  obser text,
  hora text,
  plato text,
  poremps text,
  codemp2 text,
  comision2 text,
  creditos text,
  codalu text,
  idtalla text,
  idcolor text,
  pvpcom text,
  pulsos text,
  energia text,
  bonconfig text,
  numser text,
  idticand text,
  idlinand text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_faclintmp_imported_at ON legacy.faclintmp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.facproc (
  serfacp text,
  ejefacp text,
  numfacp text,
  fecfacp text,
  seralb text,
  ejealb text,
  numalb text,
  sufacp text,
  codpro text,
  obsfac text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  totfacp text,
  lineas text,
  impresa text,
  forpag text,
  fijo1 text,
  fijo2 text,
  fijo3 text,
  numpag text,
  pripag text,
  entpag text,
  dtopp text,
  dto1 text,
  enviar text,
  idconcepto text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  codban text,
  cueban text,
  contab text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_facproc_imported_at ON legacy.facproc (imported_at);

CREATE TABLE IF NOT EXISTS legacy.facprol (
  serfacp text,
  ejefacp text,
  numfacp text,
  linfacp text,
  seralb text,
  ejealb text,
  numalb text,
  linalb text,
  codart text,
  desart text,
  preven text,
  canser text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  idtalla text,
  idcolor text,
  numser text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_facprol_imported_at ON legacy.facprol (imported_at);

CREATE TABLE IF NOT EXISTS legacy.familia1 (
  codfam1 text,
  desfam1 text,
  tipfam1 text,
  enviar text,
  vender text,
  foto text,
  obsoleto text,
  idpuesto text,
  codcuev text,
  codcuec text,
  estvenmen text,
  colorf text,
  colorl text,
  orden text,
  enviarweb text,
  puntos text,
  prestashop text,
  presenv text,
  obsfam text,
  presmettit text,
  presmetdes text,
  presmetkey text,
  presurlami text,
  prescatsup text,
  presroot text,
  prescodfam text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_familia1_imported_at ON legacy.familia1 (imported_at);

CREATE TABLE IF NOT EXISTS legacy.favoritos (
  idmenu text,
  favorito text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_favoritos_imported_at ON legacy.favoritos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.festivos (
  fecha text,
  desfecha text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_festivos_imported_at ON legacy.festivos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.firmas (
  idfirma text,
  codrel text,
  tabrel text,
  firma text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_firmas_imported_at ON legacy.firmas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.forpag (
  codfp text,
  des text,
  foto text,
  vender text,
  codcuev text,
  codcuec text,
  enviar text,
  remesas text,
  serie text,
  fpefac text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_forpag_imported_at ON legacy.forpag (imported_at);

CREATE TABLE IF NOT EXISTS legacy.fotos (
  idfoto text,
  tabla text,
  idtabla text,
  ruta text,
  desfoto text,
  obsfoto text,
  facebook text,
  facebookdt text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_fotos_imported_at ON legacy.fotos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.fotostmp (
  idfoto text,
  ruta text,
  idticket text,
  desfoto text,
  obsfoto text,
  facebook text,
  facebookdt text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_fotostmp_imported_at ON legacy.fotostmp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.galerias (
  idfoto text,
  ordfoto text,
  rutafoto text,
  txtfoto text,
  enviarweb text,
  obsfoto text,
  facebook text,
  facebookdt text,
  rutafoto2 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_galerias_imported_at ON legacy.galerias (imported_at);

CREATE TABLE IF NOT EXISTS legacy.gascab (
  numgas text,
  fecgas text,
  hora text,
  obsgas text,
  lineas text,
  codemp text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_gascab_imported_at ON legacy.gascab (imported_at);

CREATE TABLE IF NOT EXISTS legacy.grualu (
  idgrualu text,
  desgrualu text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_grualu_imported_at ON legacy.grualu (imported_at);

CREATE TABLE IF NOT EXISTS legacy.grupos (
  codgru text,
  desgru text,
  ladmin text,
  obsusu text,
  busxdias text,
  ndiasbus text,
  nocosteart text,
  nobonoscli text,
  resvendia text,
  notelcli text,
  notelpla text,
  nomailcli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_grupos_imported_at ON legacy.grupos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.impresoras (
  idpc text,
  idpuesto text,
  impresora1 text,
  impresora2 text,
  impresora3 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_impresoras_imported_at ON legacy.impresoras (imported_at);

CREATE TABLE IF NOT EXISTS legacy.lopd (
  fechahora text,
  codusu text,
  codpan text,
  descrip text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_lopd_imported_at ON legacy.lopd (imported_at);

CREATE TABLE IF NOT EXISTS legacy.menudet (
  idmenu text,
  codart text,
  desart text,
  grupo text,
  linea text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_menudet_imported_at ON legacy.menudet (imported_at);

CREATE TABLE IF NOT EXISTS legacy.mesas (
  idmesa text,
  nommesa text,
  color text,
  tarifa text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_mesas_imported_at ON legacy.mesas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.motsal (
  codmot text,
  desmot text,
  obsmot text,
  foto text,
  obsoleto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_motsal_imported_at ON legacy.motsal (imported_at);

CREATE TABLE IF NOT EXISTS legacy.numser (
  codart text,
  numser text,
  fecent text,
  fecsal text,
  docent text,
  tipdocent text,
  docsal text,
  tipdocsal text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_numser_imported_at ON legacy.numser (imported_at);

CREATE TABLE IF NOT EXISTS legacy.obsplan (
  fecha text,
  obsplan text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_obsplan_imported_at ON legacy.obsplan (imported_at);

CREATE TABLE IF NOT EXISTS legacy.ofertas (
  codofe text,
  desofe text,
  feciniofe text,
  fecfinofe text,
  obsoleto text,
  lunes text,
  martes text,
  miercoles text,
  jueves text,
  viernes text,
  sabado text,
  domingo text,
  obsofe text,
  productos text,
  dtoprod text,
  servicios text,
  dtoserv text,
  rutafoto text,
  facebook text,
  facebookdt text,
  enviarweb text,
  orden text,
  rutafoto1 text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_ofertas_imported_at ON legacy.ofertas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.ofertasfam (
  codofe text,
  codfam1 text,
  dto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_ofertasfam_imported_at ON legacy.ofertasfam (imported_at);

CREATE TABLE IF NOT EXISTS legacy.pantallas (
  codpan text,
  despan text,
  lopd text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_pantallas_imported_at ON legacy.pantallas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.pedproc (
  serped text,
  ejeped text,
  numped text,
  suped text,
  fecped text,
  fecent text,
  codpro text,
  obsped text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  totped text,
  lineas text,
  impresa text,
  forpag text,
  fijo1 text,
  fijo2 text,
  fijo3 text,
  numpag text,
  pripag text,
  entpag text,
  dtopp text,
  dto1 text,
  final text,
  enviar text,
  idconcepto text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  codban text,
  cueban text,
  efactusol text,
  pedonline text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_pedproc_imported_at ON legacy.pedproc (imported_at);

CREATE TABLE IF NOT EXISTS legacy.pedprol (
  serped text,
  ejeped text,
  numped text,
  linped text,
  codart text,
  desart text,
  preven text,
  canped text,
  canpen text,
  canser text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  idtalla text,
  idcolor text,
  nseries text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_pedprol_imported_at ON legacy.pedprol (imported_at);

CREATE TABLE IF NOT EXISTS legacy.plan2009 (
  idplan text,
  codemp text,
  codcli text,
  fecha text,
  horini text,
  horfin text,
  texto text,
  codrec text,
  nomcli text,
  tel1cli text,
  colfon text,
  collet text,
  facturado text,
  enviar text,
  idusuweb text,
  enviadoand text,
  macand text,
  idand text,
  enviadocro text,
  idcro text,
  enviadoadd text,
  idplanrel text,
  codproce text,
  horaman text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_plan2009_imported_at ON legacy.plan2009 (imported_at);

CREATE TABLE IF NOT EXISTS legacy.planart (
  idplan text,
  codart text,
  hora text,
  enviar text,
  artcom text,
  artcomrel text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_planart_imported_at ON legacy.planart (imported_at);

CREATE TABLE IF NOT EXISTS legacy.planificador (
  fecha text,
  hora text,
  cliente text,
  observ text,
  codemp text,
  idplan text,
  color text,
  facturado text,
  clientebd text,
  codart text,
  codrec text,
  telefono text,
  idplanrel text,
  horafin text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_planificador_imported_at ON legacy.planificador (imported_at);

CREATE TABLE IF NOT EXISTS legacy.plansms (
  idsms text,
  dessms text,
  texto text,
  tipsms text,
  enviar text,
  allcentros text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_plansms_imported_at ON legacy.plansms (imported_at);

CREATE TABLE IF NOT EXISTS legacy.plantmp (
  idplantmp text,
  codusu text,
  fechortmp text,
  tiptmp text,
  idplan text,
  codemp text,
  codcli text,
  fecha text,
  horini text,
  horfin text,
  texto text,
  codrec text,
  nomcli text,
  tel1cli text,
  planart text,
  colfon text,
  collet text,
  codempx text,
  codclix text,
  fechax text,
  horinix text,
  horfinx text,
  textox text,
  codrecx text,
  nomclix text,
  tel1clix text,
  planartx text,
  colfonx text,
  colletx text,
  estado text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_plantmp_imported_at ON legacy.plantmp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.precab (
  serpre text,
  ejepre text,
  numpre text,
  fecha text,
  hora text,
  codcli text,
  obser text,
  impbas1 text,
  impbas2 text,
  impbas3 text,
  impbas4 text,
  impiva1 text,
  impiva2 text,
  impiva3 text,
  impiva4 text,
  iva1 text,
  iva2 text,
  iva3 text,
  iva4 text,
  totimpbas text,
  totimpdto text,
  totimpiva text,
  total text,
  lineas text,
  impresa text,
  dtopp text,
  dto1 text,
  dtocam text,
  dtoaso text,
  dtomav text,
  dtovar text,
  anulada text,
  puntos text,
  codemp text,
  foto1 text,
  foto2 text,
  enviar text,
  sexo text,
  idconcepto text,
  codboncli1 text,
  codboncli2 text,
  impbono1 text,
  impbono2 text,
  mesa text,
  comensales text,
  actrec text,
  rec1 text,
  rec2 text,
  rec3 text,
  rec4 text,
  imprec1 text,
  imprec2 text,
  imprec3 text,
  imprec4 text,
  totimprec text,
  actirpfp text,
  irpfp text,
  impirpfp text,
  ntickets text,
  codalu text,
  ticeval text,
  contab text,
  fechorfin text,
  facimp text,
  plato text,
  albaranado text,
  numalbrel text,
  facturado text,
  numfacrel text,
  estado text,
  impcob text,
  siniva text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_precab_imported_at ON legacy.precab (imported_at);

CREATE TABLE IF NOT EXISTS legacy.prelin (
  serpre text,
  ejepre text,
  numpre text,
  linpre text,
  codart text,
  desart text,
  tipfam1 text,
  precio text,
  coste text,
  cant text,
  subtot text,
  descuento text,
  taniva text,
  obser text,
  codemp text,
  comision text,
  codboncli text,
  codbon text,
  estado text,
  hora text,
  impreso text,
  plato text,
  poremps text,
  codemp2 text,
  comision2 text,
  creditos text,
  codalu text,
  idtalla text,
  idcolor text,
  pvpcom text,
  pulsos text,
  energia text,
  foto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_prelin_imported_at ON legacy.prelin (imported_at);

CREATE TABLE IF NOT EXISTS legacy.presencia (
  idpres text,
  fechor text,
  tippres text,
  codmot text,
  codemp text,
  empalu text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_presencia_imported_at ON legacy.presencia (imported_at);

CREATE TABLE IF NOT EXISTS legacy.procedencia (
  codproce text,
  desproce text,
  obsproce text,
  obsoleto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_procedencia_imported_at ON legacy.procedencia (imported_at);

CREATE TABLE IF NOT EXISTS legacy.procliemp (
  codproce text,
  desproce text,
  obsproce text,
  obsoleto text,
  descorta text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_procliemp_imported_at ON legacy.procliemp (imported_at);

CREATE TABLE IF NOT EXISTS legacy.profesores (
  codprof text,
  nomprof text,
  ape1prof text,
  mail text,
  dniprof text,
  dirprof text,
  codposprof text,
  pobprof text,
  proprof text,
  asenta text,
  pais text,
  tel1prof text,
  tel2prof text,
  tel3prof text,
  foto text,
  obsprof text,
  obsoleto text,
  fecbaja text,
  fecalta text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_profesores_imported_at ON legacy.profesores (imported_at);

CREATE TABLE IF NOT EXISTS legacy.proveedor (
  codpro text,
  razon text,
  razon2 text,
  nifpro text,
  dirpro text,
  codpospro text,
  pobpro text,
  propro text,
  asenta text,
  pais text,
  tel1pro text,
  tel2pro text,
  tel3pro text,
  tippro text,
  coddivpro text,
  forpagpro text,
  fijo1 text,
  fijo2 text,
  fijo3 text,
  pripag text,
  entpag text,
  numpag text,
  obspro text,
  dtopp text,
  dto1 text,
  webpro text,
  enviar text,
  cueban text,
  obsoleto text,
  codcue text,
  mailpro text,
  percon text,
  iban text,
  swift text,
  nosms text,
  noemail text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_proveedor_imported_at ON legacy.proveedor (imported_at);

CREATE TABLE IF NOT EXISTS legacy.puestos (
  idpuesto text,
  nompuesto text,
  impresora text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_puestos_imported_at ON legacy.puestos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.recursos (
  codrec text,
  desrec text,
  obsrec text,
  obsoleto text,
  foto text,
  ordplan text,
  verplan text,
  enviar text,
  colorpf text,
  colorpl text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_recursos_imported_at ON legacy.recursos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.registros (
  tabla text,
  serie text,
  year text,
  numreg text,
  descrip text,
  visible text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_registros_imported_at ON legacy.registros (imported_at);

CREATE TABLE IF NOT EXISTS legacy.reports (
  nomrep text,
  idgrupo text,
  nomfrx text,
  interno text,
  predet text,
  nomrepidi text,
  orden text,
  filtro text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_reports_imported_at ON legacy.reports (imported_at);

CREATE TABLE IF NOT EXISTS legacy.series (
  serie text,
  desser text,
  recargov text,
  recargoc text,
  irpfpv text,
  irpfpc text,
  facini text,
  mxcodbar text,
  mxnumapr text,
  mxfecapr text,
  mxdnumfac text,
  mxhnumfac text,
  mxavifec text,
  mxdiasant text,
  mxavinum text,
  mxnumant text,
  mxdiaavi text,
  mxfacavi text,
  efactura text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_series_imported_at ON legacy.series (imported_at);

CREATE TABLE IF NOT EXISTS legacy.sms (
  fecha text,
  remitente text,
  telefono text,
  texto text,
  estado text,
  msgerror text,
  prefijo text,
  codcli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_sms_imported_at ON legacy.sms (imported_at);

CREATE TABLE IF NOT EXISTS legacy.smsauto (
  idplan text,
  desplan text,
  activado text,
  avifel text,
  avipla text,
  aviage text,
  avicli text,
  diasavi text,
  horavi text,
  txtfel text,
  txtpla text,
  txtage text,
  txtcli text,
  remitente text,
  fecult text,
  horult text,
  fecini text,
  fecfin text,
  anteriores text,
  ndiasant text,
  dcodcli text,
  hcodcli text,
  dcodpos text,
  hcodpos text,
  didtipcli text,
  hidtipcli text,
  hombre text,
  mujer text,
  nino text,
  anicli text,
  dfecani text,
  hfecani text,
  noobscli text,
  allcentros text,
  enviar text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_smsauto_imported_at ON legacy.smsauto (imported_at);

CREATE TABLE IF NOT EXISTS legacy.smsautoreg (
  idplanreg text,
  idplan text,
  fecha text,
  hora text,
  estado text,
  msgerror text,
  smsenvfel text,
  smserrfel text,
  smsenvpla text,
  smserrpla text,
  smsenvage text,
  smserrage text,
  smsenvtot text,
  smserrtot text,
  mostrar text,
  smsenvcli text,
  smserrcli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_smsautoreg_imported_at ON legacy.smsautoreg (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tallas (
  idtalla text,
  idgrupo text,
  destalla text,
  enviar text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tallas_imported_at ON legacy.tallas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tallasgru (
  idgrupo text,
  desgru text,
  obsgru text,
  enviar text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tallasgru_imported_at ON legacy.tallasgru (imported_at);

CREATE TABLE IF NOT EXISTS legacy.ticketprec (
  idticpre text,
  destic text,
  foto text,
  obstic text,
  obsoleto text,
  lineas text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_ticketprec_imported_at ON legacy.ticketprec (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tiendas (
  idtienda text,
  nomtie text,
  dirtie text,
  cptie text,
  pobtie text,
  protie text,
  paistie text,
  tel1tie text,
  tel2tie text,
  faxtie text,
  mailtie text,
  percontie text,
  central text,
  serie text,
  obstie text,
  tipcom text,
  enviar text,
  ruta text,
  ciftie text,
  cfactusol text,
  tarifa text,
  tarifa2 text,
  obsoleto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tiendas_imported_at ON legacy.tiendas (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tipart (
  idtipart text,
  destipart text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tipart_imported_at ON legacy.tipart (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tipcli (
  idtipcli text,
  destipcli text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tipcli_imported_at ON legacy.tipcli (imported_at);

CREATE TABLE IF NOT EXISTS legacy.tipmov (
  codtipmov text,
  destipmov text,
  obstipmov text,
  enviar text,
  tipdoc text,
  foto text,
  obsoleto text,
  colorf text,
  colorl text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_tipmov_imported_at ON legacy.tipmov (imported_at);

CREATE TABLE IF NOT EXISTS legacy.turnos (
  diatur text,
  turno text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_turnos_imported_at ON legacy.turnos (imported_at);

CREATE TABLE IF NOT EXISTS legacy.usuarios (
  codusu text,
  nomusu text,
  apeusu text,
  passusu text,
  codgru text,
  obsusu text,
  ididi text,
  foto text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_usuarios_imported_at ON legacy.usuarios (imported_at);

