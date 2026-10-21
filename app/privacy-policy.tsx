import PolicyScreen from '@/components/common/PolicyScreen';
import { PRIVACY_POLICY } from '@/data/legalPolicies';
import React from 'react';

export default function PrivacyPolicyScreen() {
  return <PolicyScreen document={PRIVACY_POLICY} icon="security" relatedPolicy={{ title: 'Terms and Conditions', href: '/terms-and-conditions' }} additionalPolicies={[{ title: 'Cookie Policy', href: '/cookie-policy', icon: 'cookie' }, { title: 'Delete my account', href: '/delete-account', icon: 'person-remove' }]} showPrivacyReference variant="plain" />;
}
