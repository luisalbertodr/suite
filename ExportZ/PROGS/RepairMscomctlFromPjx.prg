* OBSOLETO: usar RepairMscomctlFromLfn.prg (lista desde mscomctl.lfn).
MESSAGEBOX("RepairMscomctlFromPjx ya no se usa."+CHR(13)+CHR(13)+;
   "Redirigiendo a RepairMscomctlFromLfn ...", 48, "Reparar")
DO (JUSTPATH(SYS(16))+"RepairMscomctlFromLfn.prg")
