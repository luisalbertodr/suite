import React from 'react';
import { Whatsapp } from '@/components/whatsapp/Whatsapp';
import { PageWrapper } from '@/components/PageWrapper';

const WhatsappPage: React.FC = () => {
  return (
    <PageWrapper resource="whatsapp" action="read">
      <Whatsapp />
    </PageWrapper>
  );
};

export default WhatsappPage;
