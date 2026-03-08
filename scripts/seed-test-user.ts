import "dotenv/config";
import {
  LeadStatus,
  LeadSourceType,
  MembershipRole,
  MessageChannel,
  MessageDirection,
  QualificationFit,
  QuestionType,
  RuleSeverity,
  TemplateType,
} from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { ensureWorkspaceForUser } from "../src/lib/workspaces";

const TEST_EMAIL = "test@roomflow.local";
const TEST_PASSWORD = "Roomflow123!";
const TEST_NAME = "Roomflow Test User";

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: TEST_EMAIL,
    },
  });

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email: TEST_EMAIL,
    },
  });

  const existingWorkspace = await ensureWorkspaceForUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  await prisma.workspace.delete({
    where: {
      id: existingWorkspace.id,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Roomflow Test Workspace",
      slug: existingWorkspace.slug,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: MembershipRole.OWNER,
    },
  });

  const [manualSource, spareRoomSource, facebookSource, zillowSource] =
    await Promise.all([
      prisma.leadSource.create({
        data: {
          workspaceId: workspace.id,
          name: "Manual intake",
          type: LeadSourceType.MANUAL,
        },
      }),
      prisma.leadSource.create({
        data: {
          workspaceId: workspace.id,
          name: "SpareRoom",
          type: LeadSourceType.SPAREROOM,
        },
      }),
      prisma.leadSource.create({
        data: {
          workspaceId: workspace.id,
          name: "Facebook Marketplace",
          type: LeadSourceType.FACEBOOK,
        },
      }),
      prisma.leadSource.create({
        data: {
          workspaceId: workspace.id,
          name: "Zillow",
          type: LeadSourceType.ZILLOW,
        },
      }),
    ]);

  const mapleHouse = await prisma.property.create({
    data: {
      workspaceId: workspace.id,
      name: "Maple House",
      propertyType: "Shared house",
      addressLine1: "18 Maple Ave",
      locality: "Providence, RI",
      rentableRoomCount: 4,
      sharedBathroomCount: 2,
      parkingAvailable: true,
      smokingAllowed: false,
      petsAllowed: false,
      schedulingUrl: "https://calendar.example.com/maple-house-tour",
    },
  });

  const harborFlat = await prisma.property.create({
    data: {
      workspaceId: workspace.id,
      name: "Harbor Flat",
      propertyType: "Apartment",
      addressLine1: "44 Harbor St",
      locality: "Providence, RI",
      rentableRoomCount: 2,
      sharedBathroomCount: 1,
      parkingAvailable: false,
      smokingAllowed: false,
      petsAllowed: false,
      schedulingUrl: "https://calendar.example.com/harbor-flat-tour",
    },
  });

  const mapleQuestionSet = await prisma.qualificationQuestionSet.create({
    data: {
      propertyId: mapleHouse.id,
      name: "Maple House default prescreen",
      isDefault: true,
    },
  });

  const harborQuestionSet = await prisma.qualificationQuestionSet.create({
    data: {
      propertyId: harborFlat.id,
      name: "Harbor Flat default prescreen",
      isDefault: true,
    },
  });

  const [smokingQuestion, petsQuestion, parkingQuestion, bathroomQuestion] =
    await Promise.all([
      prisma.qualificationQuestion.create({
        data: {
          questionSetId: mapleQuestionSet.id,
          label: "Smoking",
          fieldKey: "smoking",
          type: QuestionType.YES_NO,
          sortOrder: 0,
        },
      }),
      prisma.qualificationQuestion.create({
        data: {
          questionSetId: mapleQuestionSet.id,
          label: "Pets",
          fieldKey: "pets",
          type: QuestionType.TEXT,
          sortOrder: 1,
        },
      }),
      prisma.qualificationQuestion.create({
        data: {
          questionSetId: mapleQuestionSet.id,
          label: "Parking need",
          fieldKey: "parking_need",
          type: QuestionType.TEXT,
          sortOrder: 2,
        },
      }),
      prisma.qualificationQuestion.create({
        data: {
          questionSetId: mapleQuestionSet.id,
          label: "Shared bathroom acceptance",
          fieldKey: "shared_bathroom_acceptance",
          type: QuestionType.YES_NO,
          sortOrder: 3,
        },
      }),
    ]);

  const [harborPetsQuestion, harborQuietHoursQuestion] = await Promise.all([
    prisma.qualificationQuestion.create({
      data: {
        questionSetId: harborQuestionSet.id,
        label: "Pets",
        fieldKey: "pets",
        type: QuestionType.TEXT,
        sortOrder: 0,
      },
    }),
    prisma.qualificationQuestion.create({
      data: {
        questionSetId: harborQuestionSet.id,
        label: "Quiet hours acknowledgement",
        fieldKey: "quiet_hours",
        type: QuestionType.YES_NO,
        sortOrder: 1,
      },
    }),
  ]);

  await prisma.propertyRule.createMany({
    data: [
      {
        propertyId: mapleHouse.id,
        label: "No smoking",
        category: "Lifestyle",
        description: "Applies to bedrooms and shared areas.",
        severity: RuleSeverity.REQUIRED,
        autoDecline: true,
      },
      {
        propertyId: mapleHouse.id,
        label: "No pets",
        category: "Compatibility",
        description: "Current residents have allergies.",
        severity: RuleSeverity.REQUIRED,
        autoDecline: true,
      },
      {
        propertyId: mapleHouse.id,
        label: "Shared bathroom acceptance",
        category: "Logistics",
        description: "Two bedrooms share each bathroom.",
        severity: RuleSeverity.REQUIRED,
      },
      {
        propertyId: mapleHouse.id,
        label: "Quiet hours acknowledgement",
        category: "House operations",
        description: "Two residents work early shifts.",
        severity: RuleSeverity.WARNING,
        warningOnly: true,
      },
      {
        propertyId: harborFlat.id,
        label: "No pets",
        category: "Compatibility",
        description: "Building policy is pet-free.",
        severity: RuleSeverity.REQUIRED,
        autoDecline: true,
      },
      {
        propertyId: harborFlat.id,
        label: "Quiet hours acknowledgement",
        category: "House operations",
        description: "Required because the downstairs tenant works from home.",
        severity: RuleSeverity.REQUIRED,
      },
    ],
  });

  const [
    screeningInviteTemplate,
    missingInfoTemplate,
    tourInviteTemplate,
    applicationInviteTemplate,
    declineTemplate,
  ] = await Promise.all([
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Screening invite",
        type: TemplateType.SCREENING_INVITE,
        channel: MessageChannel.EMAIL,
        subject: "Room inquiry follow-up",
        body: "Thanks for reaching out about {{property.name}}. I just need a few quick answers about move-in timing, budget, and house rules before I can confirm fit.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Missing information follow-up",
        type: TemplateType.MISSING_INFO_FOLLOW_UP,
        channel: MessageChannel.SMS,
        body: "Thanks again. I still need your target move-in date and monthly budget to keep the inquiry moving.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Tour invite",
        type: TemplateType.TOUR_INVITE,
        channel: MessageChannel.EMAIL,
        subject: "Tour scheduling link",
        body: "You look like a strong fit so far for {{property.name}}. Use this link to choose a tour time that works for you: {{property.schedulingUrl}}",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Application invite",
        type: TemplateType.APPLICATION_INVITE,
        channel: MessageChannel.EMAIL,
        subject: "Application for {{property.name}}",
        body: "You are ready for the next step. Reply here after you complete the application for {{property.name}}.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Rule mismatch decline",
        type: TemplateType.DECLINE,
        channel: MessageChannel.EMAIL,
        subject: "Update on your room inquiry",
        body: "Thanks for the interest. Based on the property rules, I cannot move this inquiry forward for this specific listing.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "House rules acknowledgment",
        type: TemplateType.HOUSE_RULES_ACKNOWLEDGMENT,
        channel: MessageChannel.EMAIL,
        subject: "Shared house expectations for {{property.name}}",
        body: "Before we lock in next steps, please confirm that the shared-house expectations for {{property.name}} work for you.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Onboarding welcome",
        type: TemplateType.ONBOARDING,
        channel: MessageChannel.EMAIL,
        subject: "Welcome to {{property.name}}",
        body: "Welcome aboard. Here is the onboarding checklist and move-in coordination info for {{property.name}}.",
      },
    }),
    prisma.messageTemplate.create({
      data: {
        workspaceId: workspace.id,
        name: "Waitlist notice",
        type: TemplateType.WAITLIST_NOTICE,
        channel: MessageChannel.EMAIL,
        subject: "Waitlist update for {{property.name}}",
        body: "There is not an immediate opening at {{property.name}}, but I can keep your inquiry active on the waitlist and reach out if availability changes.",
      },
    }),
  ]);

  const avery = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      propertyId: mapleHouse.id,
      leadSourceId: spareRoomSource.id,
      fullName: "Avery Mason",
      phone: "+14015550101",
      preferredContactChannel: "SMS",
      moveInDate: daysFromNow(24),
      monthlyBudget: 950,
      stayLengthMonths: 6,
      workStatus: "Hybrid support specialist",
      notes: "Asked about parking and quiet hours.",
      status: LeadStatus.AWAITING_RESPONSE,
      fitResult: QualificationFit.UNKNOWN,
      lastActivityAt: hoursAgo(2),
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(2),
    },
  });

  const jordan = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      propertyId: mapleHouse.id,
      leadSourceId: facebookSource.id,
      fullName: "Jordan Kim",
      email: "jordan.kim@example.com",
      preferredContactChannel: "EMAIL",
      moveInDate: daysFromNow(12),
      monthlyBudget: 1050,
      stayLengthMonths: 12,
      workStatus: "Nurse, overnight shifts",
      notes: "Good fit, wants application link after tour.",
      status: LeadStatus.APPLICATION_SENT,
      fitResult: QualificationFit.PASS,
      lastActivityAt: hoursAgo(0.5),
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(0.5),
    },
  });

  const samira = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      propertyId: harborFlat.id,
      leadSourceId: zillowSource.id,
      fullName: "Samira Ali",
      email: "samira.ali@example.com",
      preferredContactChannel: "EMAIL",
      moveInDate: daysFromNow(40),
      monthlyBudget: 850,
      stayLengthMonths: 3,
      workStatus: "Graduate student",
      notes: "Requested a pet exception for one indoor cat.",
      status: LeadStatus.DECLINED,
      fitResult: QualificationFit.MISMATCH,
      lastActivityAt: daysAgo(1),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  });

  const casey = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      propertyId: mapleHouse.id,
      leadSourceId: manualSource.id,
      fullName: "Casey Nguyen",
      email: "casey.nguyen@example.com",
      phone: "+14015550104",
      preferredContactChannel: "EMAIL",
      moveInDate: daysFromNow(30),
      monthlyBudget: 900,
      stayLengthMonths: 9,
      workStatus: "Freelance designer",
      notes: "Missing budget confirmation and bathroom answer.",
      status: LeadStatus.INCOMPLETE,
      fitResult: QualificationFit.CAUTION,
      lastActivityAt: hoursAgo(9),
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(9),
    },
  });

  const morgan = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      leadSourceId: manualSource.id,
      fullName: "Morgan Lee",
      email: "morgan.lee@example.com",
      preferredContactChannel: "EMAIL",
      moveInDate: daysFromNow(18),
      monthlyBudget: 980,
      stayLengthMonths: 8,
      workStatus: "Restaurant manager",
      notes: "Needs property assignment before fit review.",
      status: LeadStatus.NEW,
      fitResult: QualificationFit.UNKNOWN,
      lastActivityAt: hoursAgo(4),
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(4),
    },
  });

  await prisma.contact.createMany({
    data: [
      {
        leadId: avery.id,
        phone: avery.phone,
        preferredChannel: "SMS",
      },
      {
        leadId: jordan.id,
        email: jordan.email,
        preferredChannel: "EMAIL",
      },
      {
        leadId: samira.id,
        email: samira.email,
        preferredChannel: "EMAIL",
      },
      {
        leadId: casey.id,
        email: casey.email,
        phone: casey.phone,
        preferredChannel: "EMAIL",
      },
      {
        leadId: morgan.id,
        email: morgan.email,
        preferredChannel: "EMAIL",
      },
    ],
  });

  const [
    averyConversation,
    jordanConversation,
    samiraConversation,
    caseyConversation,
    morganConversation,
  ] =
    await Promise.all([
      prisma.conversation.create({
        data: {
          leadId: avery.id,
          subject: "SpareRoom room inquiry",
        },
      }),
      prisma.conversation.create({
        data: {
          leadId: jordan.id,
          subject: "Facebook Marketplace inquiry",
        },
      }),
      prisma.conversation.create({
        data: {
          leadId: samira.id,
          subject: "Zillow inquiry",
        },
      }),
      prisma.conversation.create({
        data: {
          leadId: casey.id,
          subject: "Manual intake follow-up",
        },
      }),
      prisma.conversation.create({
        data: {
          leadId: morgan.id,
          subject: "Need help choosing the right property",
        },
      }),
    ]);

  await prisma.message.createMany({
    data: [
      {
        conversationId: averyConversation.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.SMS,
        body: "Hi, is the room still available? I can move in next month.",
        receivedAt: hoursAgo(6),
        createdAt: hoursAgo(6),
      },
      {
        conversationId: averyConversation.id,
        templateId: missingInfoTemplate.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.SMS,
        body: "Yes. A few quick questions first so I can confirm fit.",
        sentAt: hoursAgo(5),
        createdAt: hoursAgo(5),
      },
      {
        conversationId: jordanConversation.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Room inquiry",
        body: "I saw the room listed on Facebook and would love to learn more.",
        receivedAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
      {
        conversationId: jordanConversation.id,
        templateId: tourInviteTemplate.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Tour scheduling link",
        body: "Thanks. You look like a solid fit, here is the tour scheduling link.",
        sentAt: hoursAgo(1),
        createdAt: hoursAgo(1),
      },
      {
        conversationId: samiraConversation.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Cat question",
        body: "I am interested, but I do have one indoor cat.",
        receivedAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
      {
        conversationId: samiraConversation.id,
        templateId: declineTemplate.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Update on your room inquiry",
        body: "Thanks for the interest. This property cannot accommodate pets.",
        sentAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
      {
        conversationId: caseyConversation.id,
        templateId: screeningInviteTemplate.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Room inquiry follow-up",
        body: "Thanks for reaching out. I still need your budget and bathroom-sharing answer.",
        sentAt: hoursAgo(20),
        createdAt: hoursAgo(20),
      },
      {
        conversationId: jordanConversation.id,
        templateId: applicationInviteTemplate.id,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Application for Maple House",
        body: "You are ready for the next step. Reply here after you complete the application for Maple House.",
        sentAt: hoursAgo(0.5),
        createdAt: hoursAgo(0.5),
      },
      {
        conversationId: morganConversation.id,
        direction: MessageDirection.INBOUND,
        channel: MessageChannel.EMAIL,
        subject: "Looking for a room",
        body: "I am interested in a room around $1,000 and can move later this month. Which property would be the best fit?",
        receivedAt: hoursAgo(4),
        createdAt: hoursAgo(4),
      },
    ],
  });

  await prisma.qualificationAnswer.createMany({
    data: [
      {
        leadId: avery.id,
        questionId: smokingQuestion.id,
        value: "No",
      },
      {
        leadId: avery.id,
        questionId: petsQuestion.id,
        value: "No",
      },
      {
        leadId: avery.id,
        questionId: parkingQuestion.id,
        value: "Street only is fine",
      },
      {
        leadId: avery.id,
        questionId: bathroomQuestion.id,
        value: "Yes",
      },
      {
        leadId: jordan.id,
        questionId: smokingQuestion.id,
        value: "No",
      },
      {
        leadId: jordan.id,
        questionId: petsQuestion.id,
        value: "No",
      },
      {
        leadId: jordan.id,
        questionId: parkingQuestion.id,
        value: "No parking needed",
      },
      {
        leadId: jordan.id,
        questionId: bathroomQuestion.id,
        value: "Yes",
      },
      {
        leadId: samira.id,
        questionId: harborPetsQuestion.id,
        value: "One cat",
      },
      {
        leadId: samira.id,
        questionId: harborQuietHoursQuestion.id,
        value: "Yes",
      },
      {
        leadId: casey.id,
        questionId: smokingQuestion.id,
        value: "No",
      },
      {
        leadId: casey.id,
        questionId: petsQuestion.id,
        value: "No",
      },
      {
        leadId: casey.id,
        questionId: parkingQuestion.id,
        value: "Would like driveway parking if possible",
      },
    ],
  });

  await prisma.leadStatusHistory.createMany({
    data: [
      {
        leadId: avery.id,
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.AWAITING_RESPONSE,
        reason: "Initial questions sent",
        createdAt: hoursAgo(5),
      },
      {
        leadId: jordan.id,
        fromStatus: LeadStatus.AWAITING_RESPONSE,
        toStatus: LeadStatus.QUALIFIED,
        reason: "Rules evaluated cleanly",
        createdAt: hoursAgo(2),
      },
      {
        leadId: jordan.id,
        fromStatus: LeadStatus.QUALIFIED,
        toStatus: LeadStatus.APPLICATION_SENT,
        reason: "Application invite sent",
        createdAt: hoursAgo(0.5),
      },
      {
        leadId: samira.id,
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.DECLINED,
        reason: "Pet rule mismatch",
        createdAt: daysAgo(1),
      },
      {
        leadId: casey.id,
        fromStatus: LeadStatus.NEW,
        toStatus: LeadStatus.INCOMPLETE,
        reason: "Missing budget and bathroom answer",
        createdAt: hoursAgo(18),
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        propertyId: mapleHouse.id,
        actorUserId: user.id,
        eventType: "Maple House rules confirmed for no-smoking and no-pets",
        createdAt: hoursAgo(10),
      },
      {
        workspaceId: workspace.id,
        leadId: avery.id,
        propertyId: mapleHouse.id,
        actorUserId: user.id,
        eventType: "Avery Mason answered the parking question",
        createdAt: hoursAgo(2),
      },
      {
        workspaceId: workspace.id,
        leadId: jordan.id,
        propertyId: mapleHouse.id,
        actorUserId: user.id,
        eventType: "Jordan Kim moved to qualified",
        createdAt: hoursAgo(1),
      },
      {
        workspaceId: workspace.id,
        leadId: jordan.id,
        propertyId: mapleHouse.id,
        actorUserId: user.id,
        eventType: "Application invite sent to Jordan Kim",
        createdAt: hoursAgo(0.5),
      },
      {
        workspaceId: workspace.id,
        leadId: samira.id,
        propertyId: harborFlat.id,
        actorUserId: user.id,
        eventType: "Samira Ali declined due to pet rule mismatch",
        createdAt: daysAgo(1),
      },
      {
        workspaceId: workspace.id,
        leadId: casey.id,
        propertyId: mapleHouse.id,
        actorUserId: user.id,
        eventType: "Casey Nguyen marked incomplete pending budget details",
        createdAt: hoursAgo(9),
      },
      {
        workspaceId: workspace.id,
        leadId: morgan.id,
        actorUserId: user.id,
        eventType: "Morgan Lee needs property assignment before evaluation",
        createdAt: hoursAgo(4),
      },
    ],
  });

  console.log(`Seeded test user: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`Workspace: ${workspace.name}`);
  console.log("Demo property, lead, rules, template, and activity records created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
