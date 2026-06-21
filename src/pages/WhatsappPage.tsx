import React from 'react';
import { Whatsapp } from '@/components/whatsapp/Whatsapp';
import { PageWrapper } from '@/components/PageWrapper';

const WhatsappPage: React.FC = () => {
  return (
    <PageWrapper resource="whatsapp" action="read">
      <div className="-mx-4 flex h-[calc(100dvh-9.5rem)] min-h-[480px] w-[calc(100%+2rem)] min-w-0 flex-col overflow-hidden sm:-mx-6 sm:w-[calc(100%+3rem)]">
        <Whatsapp />
      </div>
    </PageWrapper>
  );
};

export default WhatsappPage;
