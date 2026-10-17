import { LegalDoc, p, section } from './types';

/** Owner-supplied Garage Partner Terms & Conditions. Edit wording here only. */
export const garageTerms: LegalDoc = {
  title: 'Garage Partner Terms & Conditions',
  subtitle: 'For independent garages and service partners',
  effectiveDateField: 'garageTermsEffectiveDate',
  lastUpdated: { field: 'garageTermsLastUpdated' },
  sections: [
    section(
      1,
      'Purpose',
      p(
        'These Terms govern the relationship between BRO Co and an independent garage/service partner that accepts vehicle service jobs through the BRO Co platform.'
      )
    ),
    section(
      2,
      'Partner Eligibility & Verification',
      p(
        'The garage must provide accurate business, owner/authorized-person, address, contact, bank/payment and relevant registration details requested by BRO Co. BRO Co may conduct verification, inspection or background checks before or during the partnership.'
      )
    ),
    section(
      3,
      'Independent Service Provider',
      p(
        'The garage is an independent service provider and is responsible for the technical inspection, diagnosis, repair, maintenance, parts installation, workmanship and applicable workshop obligations for jobs it accepts.'
      )
    ),
    section(
      4,
      'Job Acceptance',
      p(
        'The garage may accept or decline a job based on capacity, technical capability, location, parts availability or other legitimate operational reasons. Once accepted, the garage should provide timely updates and follow the agreed job process.'
      )
    ),
    section(
      5,
      'Inspection & Estimate',
      p(
        'The garage must inspect the vehicle and provide an accurate estimate based on the actual condition of the vehicle. Additional work or material price changes should be submitted through BRO Co for customer approval before proceeding, except where immediate action is reasonably necessary and permitted under the agreed process.'
      )
    ),
    section(
      6,
      'Pricing & Transparency',
      p(
        'The partner must not knowingly inflate, conceal or misrepresent parts or labour charges. Approved prices should be followed. Any discounts, substitutions or changes should be disclosed and documented.'
      )
    ),
    section(
      7,
      'Parts & Consumables',
      p(
        'The garage must supply and install the type of part approved for the job. If an OEM, OES, aftermarket, genuine, used or reconditioned part is proposed, the relevant information should be communicated as required. Removed parts should be retained or returned where agreed with the customer.'
      )
    ),
    section(
      8,
      'Workmanship & Quality',
      p(
        'Repairs must be carried out using reasonable professional skill, appropriate tools, safe procedures and applicable technical requirements. The garage should perform a reasonable quality check before vehicle delivery.'
      )
    ),
    section(
      9,
      'Customer Approvals',
      p(
        'The garage must not bypass BRO Co’s approval process for additional paid work where BRO Co approval is required. Evidence of approvals should be maintained.'
      )
    ),
    section(
      10,
      'Vehicle Handling & Safety',
      p(
        'The garage must take reasonable care of vehicles while under its custody and comply with applicable safety requirements. Vehicle condition at arrival and departure should be documented where required.'
      )
    ),
    section(
      11,
      'Pickup & Delivery',
      p(
        'Where pickup/drop is coordinated through BRO Co, the garage/driver must follow the prescribed process, including identity/OTP procedures, photographs, tracking requirements and handover records where applicable.'
      )
    ),
    section(
      12,
      'Photos, Videos & Records',
      p(
        'The garage may be required to upload photographs/videos showing vehicle condition, diagnosis, repair progress, replaced parts and final condition. Records must be truthful and relate to the relevant vehicle/job.'
      )
    ),
    section(
      13,
      'Warranty & Rework',
      p(
        'The garage shall honour any warranty or workmanship commitment expressly agreed for the job. If a valid workmanship-related issue is reported, the garage should cooperate with BRO Co to inspect and resolve it. Warranty exclusions must be communicated clearly.'
      )
    ),
    section(
      14,
      'Customer Conduct',
      p(
        'The garage must treat customers professionally and must not engage in harassment, abusive conduct, unauthorized solicitation, misleading statements or discriminatory conduct.'
      )
    ),
    section(
      15,
      'Direct Customer Dealings',
      p(
        'The garage must not intentionally bypass BRO Co to divert a customer obtained through the platform for the purpose of avoiding agreed BRO Co fees or commissions. Any restrictions and applicable period should be stated in the commercial agreement signed with the garage.'
      )
    ),
    section(
      16,
      'Commission & Settlement',
      p(
        'BRO Co and the garage may agree commercial terms, including commission/service fees, settlement cycle, taxes and deductions. Such terms should be recorded separately in the partner commercial agreement or onboarding document.'
      )
    ),
    section(
      17,
      'Confidentiality',
      p(
        'The garage must protect confidential information received through BRO Co, including customer information, pricing information, platform processes, business information and non-public technical or commercial information.'
      )
    ),
    section(
      18,
      'Data Protection',
      p(
        'The garage shall use customer personal information only for legitimate service-related purposes and shall follow BRO Co’s instructions and applicable Indian data-protection requirements. Customer information must not be sold, shared for unrelated marketing or used for unauthorized purposes.'
      )
    ),
    section(
      19,
      'Intellectual Property & Brand Use',
      p(
        'BRO Co names, logos, designs, software, content, processes and other intellectual property remain the property of their respective owners. The garage may use BRO Co branding only as authorized and must not copy, modify or register confusingly similar branding.'
      )
    ),
    section(
      20,
      'Prohibited Conduct',
      p(
        'The garage must not submit false job records, fabricate photographs, manipulate invoices, perform unauthorized work, misuse customer data, conceal damage, misrepresent parts, or engage in fraudulent activity.'
      )
    ),
    section(
      21,
      'Complaints & Disputes',
      p(
        'The garage shall cooperate with reasonable investigations of customer complaints. BRO Co may review job cards, approvals, photographs, invoices, communications and other relevant records.'
      )
    ),
    section(
      22,
      'Suspension or Termination',
      p(
        'BRO Co may suspend or terminate a garage partnership for material breach, fraud, repeated quality issues, misuse of customer information, safety concerns, non-payment obligations, unauthorized customer diversion or other grounds specified in the commercial agreement, subject to applicable law and contractual terms.'
      )
    ),
    section(
      23,
      'Liability',
      p(
        'Each party remains responsible for its own acts, omissions and legal obligations. Nothing in these Terms excludes liability that cannot legally be excluded.'
      )
    ),
    section(
      24,
      'Governing Law',
      p(
        'These Terms are governed by applicable laws of India. Disputes shall be handled by the appropriate courts/authorities having jurisdiction, subject to the definitive partner agreement.'
      )
    ),
    section(
      25,
      'Acceptance',
      p(
        'By onboarding or accepting jobs through BRO Co, the garage confirms that it has read and agreed to these Terms, together with any signed commercial/partner agreement and applicable platform policies.'
      ),
      {
        type: 'details',
        title: '**{{legalName}}**',
        items: [
          { label: 'Website', value: '{{website}}' },
          { label: 'Email', value: '{{supportEmail}}' },
          { label: 'Phone', value: '{{supportPhone}}' },
        ],
      }
    ),
  ],
};
