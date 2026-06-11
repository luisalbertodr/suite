* Stubs para Build VFP del export ReFox (UDFs no extraidas del exe original).
* Solo compilacion; en runtime el exe original tiene las implementaciones reales.

PUBLIC laarrayclientesok, laarrayarticulosok, laarrayregistrosok, laarraycontactosok

FUNCTION _messagebox_android
 PARAMETER tcmsg, tnicon, tctitle
 RETURN MESSAGEBOX(tcmsg, tnicon, tctitle)
ENDFUNC

FUNCTION damemargen
 PARAMETER pncant, pncoste, pnsubtot
 LOCAL lnmargen
 IF pnsubtot = 0
    RETURN 0
 ENDIF
 lnmargen = (pnsubtot - (pncoste * pncant)) / pnsubtot * 100
 RETURN ROUND(lnmargen, 2)
ENDFUNC

FUNCTION enviaremailpresupuesto
 PARAMETER tcnumpre, tcemail, tcmsgretorno
 RETURN .T.
ENDFUNC

FUNCTION calsaldo
 PARAMETER pntipo, pnmes
 RETURN 0
ENDFUNC
