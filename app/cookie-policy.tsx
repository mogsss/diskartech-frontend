import PolicyScreen from '@/components/common/PolicyScreen';
import { COOKIE_POLICY } from '@/data/legalPolicies';
import React from 'react';

export default function CookiePolicyScreen() {
  return <PolicyScreen document={COOKIE_POLICY} icon="cookie" relatedPolicy={{ title: 'Privacy Policy', href: '/privacy-policy' }} variant="plain" />;
}
