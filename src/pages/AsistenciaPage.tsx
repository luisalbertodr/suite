import { Asistencia } from '@/components/Asistencia';
import { PageWrapper } from '@/components/PageWrapper';

const AsistenciaPage = () => (
  <PageWrapper resource="attendance" action="read">
    <Asistencia />
  </PageWrapper>
);

export default AsistenciaPage;
