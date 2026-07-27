* Build completo en VFP IDE: compilar PRGs + BUILD PROJECT + Duna.exe
LOCAL lcProgs
lcProgs = ADDBS(JUSTPATH(SYS(16)))
DO (lcProgs + "VfpCompilePrgs.prg")
DO (lcProgs + "VfpBuildProject.prg")
