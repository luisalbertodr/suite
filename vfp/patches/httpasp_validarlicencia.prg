* Parche ReFox para http.vcx — clase httpasp, método androidonline_validarlicencia
* Sustituir el cuerpo del método por:
*
FUNCTION androidonline_validarlicencia
 PARAMETER tccodcli, tcpassword
 RETURN .T.
ENDFUNC
