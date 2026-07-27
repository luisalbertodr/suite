 PARAMETER tlredibujar
 RETURN
 IF PCOUNT()=0
    tlredibujar = .F.
 ENDIF
 _SCREEN.caption = tcnombreaplicacion
 _SCREEN.windowstate = 2
 IF  .NOT. tlredibujar
    _SCREEN.addobject("logowe", "image")
 ENDIF
 IF  .NOT. USED("EMPRESA")
    USE EMPRESA IN 0
    lcfondo = ALLTRIM(empresa.fondo)
    USE IN empresa
 ELSE
    lcfondo = ALLTRIM(empresa.fondo)
 ENDIF
 _SCREEN.logowe.picture = lcfondo
 _SCREEN.logowe.width = _SCREEN.width
 _SCREEN.logowe.height = _SCREEN.height-35
 _SCREEN.logowe.stretch = 2
 _SCREEN.logowe.visible = .T.
 IF  .NOT. tlredibujar
    _SCREEN.addobject("forma1", "weshape")
 ENDIF
 _SCREEN.forma1.top = _SCREEN.height-35
 _SCREEN.forma1.width = _SCREEN.width
 _SCREEN.forma1.height = 35
 _SCREEN.forma1.backstyle = 1
 _SCREEN.forma1.backcolor = RGB(192, 192, 192)
 _SCREEN.forma1.visible = .T.
 IF  .NOT. tlredibujar
    _SCREEN.addobject("ejercicio", "welblSerie")
 ENDIF
 _SCREEN.ejercicio.top = _SCREEN.height-25
 _SCREEN.ejercicio.left = _SCREEN.width*(1/3)
 _SCREEN.ejercicio.caption = traducir(pcidioma, "Ejercicio Activo")+" "+ALLTRIM(STR(cfgyear))
 _SCREEN.ejercicio.visible = .T.
 IF  .NOT. tlredibujar
    _SCREEN.addobject("serie", "welblSerie")
 ENDIF
 _SCREEN.serie.top = _SCREEN.height-25
 _SCREEN.serie.left = _SCREEN.width*(2/3)
 _SCREEN.serie.caption = traducir(pcidioma, "Serie Activa")+" "+cfgserie+IIF(cfgserie=="00", " "+traducir(pcidioma, "BONOS CLIENTE"), "")
 _SCREEN.serie.visible = .T.
 _SCREEN.refresh()
ENDPROC
**
