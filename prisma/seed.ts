// prisma/seed.ts
// Development seed — creates a demo researcher account so you can
// explore the dashboard without going through the full ORCID OAuth flow.
// Run with: npm run db:seed

import { PrismaClient, UserRole, DataSource, PublicationType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding development database...");

  // Create a demo user
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@researchvy.com" },
    update: {},
    create: {
      email: "demo@researchvy.com",
      name: "Dr. Alex Chen",
      passwordHash,
      role: UserRole.RESEARCHER,
      emailVerified: true,
    },
  });

  // Create researcher profile
  const researcher = await prisma.researcher.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: "Dr. Alex Chen",
      institution: "MIT",
      department: "Department of Computer Science",
      country: "US",
      fields: ["Machine Learning", "Natural Language Processing", "AI Safety"],
      bio: "Researching the intersection of AI safety and large language models.",
      // Using a fake ORCID for demo — real accounts would come from OAuth
      orcidId: "0000-0001-2345-6789",
      openAlexId: "A1234567890",
      hIndex: 12,
      totalCitations: 840,
      publicationCount: 18,
    },
  });

  // Create sample publications
  const publications = [
    {
      title: "Scaling Laws for Neural Language Models",
      doi: "10.48550/arXiv.2001.08361",
      year: 2020,
      type: PublicationType.JOURNAL_ARTICLE,
      journalName: "Journal of Machine Learning Research",
      citationCount: 420,
      openAccess: true,
      openAccessUrl: "https://arxiv.org/abs/2001.08361",
      source: DataSource.OPEN_ALEX,
    },
    {
      title: "Constitutional AI: Harmlessness from AI Feedback",
      doi: "10.48550/arXiv.2212.08073",
      year: 2022,
      type: PublicationType.PREPRINT,
      venueName: "arXiv",
      citationCount: 218,
      openAccess: true,
      openAccessUrl: "https://arxiv.org/abs/2212.08073",
      source: DataSource.OPEN_ALEX,
    },
    {
      title: "Emergent Abilities of Large Language Models",
      doi: "10.48550/arXiv.2206.07682",
      year: 2022,
      type: PublicationType.CONFERENCE_PAPER,
      venueName: "TMLR",
      citationCount: 202,
      openAccess: true,
      source: DataSource.OPEN_ALEX,
    },
  ];

  for (const pub of publications) {
    await prisma.publication.upsert({
      where: { doi: pub.doi },
      update: { citationCount: pub.citationCount },
      create: {
        researcherId: researcher.id,
        ...pub,
      },
    });
  }

  console.log(`✅ Demo user created: demo@researchvy.com / demo1234`);
  console.log(`✅ Researcher profile: ${researcher.displayName}`);
  console.log(`✅ ${publications.length} sample publications created`);
  console.log("\nDone! Run 'npm run dev' to start the app.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
