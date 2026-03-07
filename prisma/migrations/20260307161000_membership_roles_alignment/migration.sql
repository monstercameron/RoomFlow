DO $$
BEGIN
  BEGIN
    ALTER TYPE "MembershipRole" RENAME VALUE 'MEMBER' TO 'MANAGER';
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'VIEWER';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
