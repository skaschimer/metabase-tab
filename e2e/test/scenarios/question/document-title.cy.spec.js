const { H } = cy;

const PG_DB_ID = 2;

describe(
  "question loading changes document title",
  { tags: "@external" },
  () => {
    beforeEach(() => {
      H.restore("postgres-12");
      cy.signInAsNormalUser();
    });

    it("should verify document title changes while loading a slow question (metabase#40051)", () => {
      cy.log("run a slow question");

      H.visitQuestionAdhoc(
        {
          dataset_query: {
            type: "native",
            native: {
              query: "select pg_sleep(60)",
            },
            database: PG_DB_ID,
          },
        },
        { skipWaiting: true },
      );

      cy.title().should("eq", "Doing science... · Metabase");
    });
  },
);
