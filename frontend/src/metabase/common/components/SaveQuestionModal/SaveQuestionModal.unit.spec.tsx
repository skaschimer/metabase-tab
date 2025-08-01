import userEvent from "@testing-library/user-event";

import { setupEnterpriseTest } from "__support__/enterprise";
import { createMockMetadata } from "__support__/metadata";
import type { CollectionEndpoints } from "__support__/server-mocks";
import {
  setupCollectionByIdEndpoint,
  setupCollectionItemsEndpoint,
  setupCollectionsEndpoints,
  setupDashboardEndpoints,
  setupRecentViewsAndSelectionsEndpoints,
} from "__support__/server-mocks";
import { mockSettings } from "__support__/settings";
import {
  mockGetBoundingClientRect,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "__support__/ui";
import { SaveQuestionModal } from "metabase/common/components/SaveQuestionModal";
import { ROOT_COLLECTION } from "metabase/entities/collections";
import * as qbSelectors from "metabase/query_builder/selectors";
import { QUESTION_NAME_MAX_LENGTH } from "metabase/questions/constants";
import * as Lib from "metabase-lib";
import Question from "metabase-lib/v1/Question";
import type {
  BaseEntityId,
  CollectionId,
  DashboardId,
} from "metabase-types/api";
import {
  createMockCollection,
  createMockCollectionItem,
  createMockDashboard,
  createMockDashboardTab,
} from "metabase-types/api/mocks";
import {
  ORDERS_ID,
  SAMPLE_DB_ID,
  createSampleDatabase,
} from "metabase-types/api/mocks/presets";
import {
  createMockQueryBuilderState,
  createMockState,
} from "metabase-types/store/mocks";

const metadata = createMockMetadata({
  databases: [createSampleDatabase()],
});

const BOBBY_TEST_COLLECTION = createMockCollection({
  archived: false,
  can_write: true,
  description: null,
  id: 1,
  location: "/",
  name: "Bobby Tables's Personal Collection",
  personal_owner_id: 100,
});

const ROOT_TEST_COLLECTION = createMockCollection({
  ...ROOT_COLLECTION,
  can_write: false,
  effective_ancestors: [],
  id: "root",
});

const FOO_DASH = createMockDashboard({
  id: 1,
  collection_id: 1,
  name: "Foo Dashboard",
  tabs: [
    createMockDashboardTab({ id: 1, name: "Foo Tab 1" }),
    createMockDashboardTab({ id: 2, name: "Foo Tab 2" }),
  ],
});

const BAR_DASH = createMockDashboard({
  id: 2,
  collection_id: 1,
  name: "Bar Dashboard",
  tabs: [],
});

const TEST_COLLECTIONS = [ROOT_TEST_COLLECTION, BOBBY_TEST_COLLECTION];

const setup = async (
  question: Question,
  originalQuestion: Question | null = null,
  {
    collectionEndpoints,
  }: {
    collectionEndpoints?: CollectionEndpoints;
  } = {},
) => {
  const onCreateMock = jest.fn((question, _options) =>
    Promise.resolve(question),
  );
  const onSaveMock = jest.fn(() => Promise.resolve());
  const onCloseMock = jest.fn();

  if (collectionEndpoints) {
    setupCollectionByIdEndpoint({
      collections: collectionEndpoints.collections,
    });
    setupCollectionsEndpoints(collectionEndpoints);
  } else {
    setupCollectionByIdEndpoint({ collections: [BOBBY_TEST_COLLECTION] });
    setupCollectionsEndpoints({
      collections: TEST_COLLECTIONS,
      rootCollection: ROOT_TEST_COLLECTION,
    });
  }

  setupCollectionItemsEndpoint({
    collection: BOBBY_TEST_COLLECTION,
    collectionItems: [],
  });
  setupDashboardEndpoints(FOO_DASH);
  setupDashboardEndpoints(BAR_DASH);

  setupRecentViewsAndSelectionsEndpoints([], ["selections"]);
  setupRecentViewsAndSelectionsEndpoints(
    [],
    ["selections", "views"],
    {},
    false,
  );

  const settings = mockSettings();

  const state = createMockState({
    settings,
    qb: createMockQueryBuilderState({
      card: question.card(),
      originalCard: originalQuestion?.card(),
    }),
  });
  const { rerender: _rerender } = renderWithProviders(
    <SaveQuestionModal
      question={question}
      originalQuestion={originalQuestion}
      onCreate={onCreateMock}
      onSave={onSaveMock}
      onClose={onCloseMock}
      opened={true}
    />,
    {
      storeInitialState: state,
    },
  );
  await screen.findByRole("button", { name: "Save" });

  const rerender = () => {
    _rerender(
      <SaveQuestionModal
        question={question}
        originalQuestion={originalQuestion}
        onCreate={onCreateMock}
        onSave={onSaveMock}
        onClose={onCloseMock}
        opened={true}
      />,
    );
  };

  return { onSaveMock, onCreateMock, onCloseMock, rerender };
};

const EXPECTED_SUGGESTED_NAME = "Orders, Count";

function getQuestion({
  isSaved,
  name = "Q1",
  description = "Example",
  collection_id = null,
  dashboard_id = null,
  can_write = true,
}: {
  isSaved?: boolean;
  name?: string;
  description?: string;
  collection_id?: CollectionId | null;
  dashboard_id?: DashboardId | null;
  can_write?: boolean;
} = {}) {
  const extraCardParams: Record<string, any> = {};

  if (isSaved) {
    extraCardParams.id = 1; // if a card has an id, it means it's saved
    extraCardParams.name = name;
    extraCardParams.description = description;
    extraCardParams.collection_id = collection_id;
    extraCardParams.dashboard_id = dashboard_id;
    extraCardParams.can_write = can_write;
  }

  return new Question(
    {
      ...extraCardParams,
      display: "table",
      visualization_settings: {},
      type: "question",
      dataset_query: {
        type: "query",
        database: SAMPLE_DB_ID,
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["count"]],
        },
      },
    },
    metadata,
  );
}

function getDirtyQuestion(originalQuestion: Question) {
  return originalQuestion
    .setQuery(Lib.limit(originalQuestion.query(), -1, 1))
    .markDirty();
}

async function fillForm({
  name,
  description,
}: {
  name?: string;
  description?: string;
}) {
  if (name) {
    const input = screen.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, name);
  }
  if (description) {
    const input = screen.getByLabelText("Description");
    await userEvent.clear(input);
    await userEvent.type(input, description);
  }
}

const saveLocDropdown = () =>
  screen.getByLabelText(/Where do you want to save this/);

describe("SaveQuestionModal", () => {
  beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  describe("new question", () => {
    it("should suggest a name for structured queries and pressing enter should submit the form", async () => {
      const { onCreateMock } = await setup(getQuestion());
      expect(screen.getByLabelText("Name")).toHaveValue(
        EXPECTED_SUGGESTED_NAME,
      );
      expect(await screen.findByRole("button", { name: "Save" })).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(onCreateMock).toHaveBeenCalled();
    });

    it("should not suggest a name for native queries", async () => {
      await setup(
        new Question(
          {
            dataset_query: {
              type: "native",
              database: ORDERS_ID,
              native: {
                query: "select * from orders",
              },
              display: "table",
            },
          },
          metadata,
        ),
      );

      expect(screen.getByLabelText("Name")).toHaveValue("");
    });

    it("should display empty description input", async () => {
      await setup(getQuestion());
      expect(screen.getByLabelText("Description")).toHaveValue("");
    });

    it("should call onCreate correctly with default form values", async () => {
      const question = getQuestion();
      const { onCreateMock } = await setup(question);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe(EXPECTED_SUGGESTED_NAME);
      expect(newQuestion.description()).toBe(null);
      expect(newQuestion.collectionId()).toBe(1);
    });

    it("should call onCreate correctly with edited form", async () => {
      const question = getQuestion();
      const { onCreateMock } = await setup(question);

      await fillForm({
        name: "My favorite orders",
        description: "So many of them",
      });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe("My favorite orders");
      expect(newQuestion.description()).toBe("So many of them");
      expect(newQuestion.collectionId()).toBe(1);
    });

    it("should not allow to enter a name with more than 254 characters", async () => {
      const question = getQuestion();
      await setup(question);

      const nameInput = screen.getByLabelText("Name");
      const descriptionInput = screen.getByLabelText("Description");
      await userEvent.clear(nameInput);
      await userEvent.paste("A".repeat(255));
      await userEvent.click(descriptionInput);

      expect(
        await screen.findByText(/must be 254 characters or less/),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole("button", { name: "Save" }),
      ).toBeDisabled();
    });

    it("should trim name and description", async () => {
      const question = getQuestion();
      const { onCreateMock } = await setup(question);

      await fillForm({
        name: "    My favorite orders ",
        description: "  So many of them   ",
      });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe("My favorite orders");
      expect(newQuestion.description()).toBe("So many of them");
      expect(newQuestion.collectionId()).toBe(1);
    });

    it('should correctly handle saving a question in the "root" collection', async () => {
      const question = getQuestion({
        collection_id: "root",
      });
      const { onCreateMock } = await setup(question);

      await fillForm({ name: "foo", description: "bar" });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe("foo");
      expect(newQuestion.description()).toBe("bar");
      expect(newQuestion.collectionId()).toBe(1);
    });

    it("shouldn't call onSave when form is submitted", async () => {
      const question = getQuestion();
      const { onSaveMock } = await setup(question);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(onSaveMock).not.toHaveBeenCalled();
    });

    it("shouldn't show a control to overwrite a saved question", async () => {
      await setup(getQuestion());
      expect(
        screen.queryByText("Save as new question"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Replace original question, ".*"/),
      ).not.toBeInTheDocument();
    });
  });

  describe("saving as a new question", () => {
    it("should offer to replace the original question by default", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      await setup(getDirtyQuestion(originalQuestion), originalQuestion);

      expect(
        screen.getByLabelText(/Replace original question, ".*"/),
      ).toBeChecked();
      expect(screen.getByText("Save as new question")).not.toBeChecked();
    });

    it("should switch to the new question form", async () => {
      const CARD = {
        name: "Q1",
        description: "Example description",
        collection_id: null,
      };
      const originalQuestion = getQuestion({ isSaved: true, ...CARD });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));

      expect(screen.getByLabelText("Name")).toHaveValue(
        `${CARD.name} - Modified`,
      );
      expect(screen.getByLabelText("Description")).toHaveValue(
        CARD.description,
      );
      expect(screen.getByText("Our analytics")).toBeInTheDocument();
    });

    it("should allow to save a question with default form values", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onCreateMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe(
        `${originalQuestion.displayName()} - Modified`,
      );
      expect(newQuestion.description()).toBe("Example");
      expect(newQuestion.collectionId()).toBe(null);
    });

    it("show allow to save a question with an edited form", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onCreateMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await fillForm({ name: "My Q", description: "Sample" });
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onCreateMock.mock.calls[0];
      expect(call.length).toBe(2);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBeUndefined();
      expect(newQuestion.displayName()).toBe("My Q");
      expect(newQuestion.description()).toBe("Sample");
      expect(newQuestion.collectionId()).toBe(null);
    });

    it("shouldn't allow to save a question if form is invalid", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      await setup(getDirtyQuestion(originalQuestion), originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await userEvent.clear(screen.getByLabelText("Name"));
      await userEvent.clear(screen.getByLabelText("Description"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      });
    });

    it("should show humanized validation message for saving a native query question", async () => {
      await setup(
        new Question(
          {
            dataset_query: {
              type: "native",
              database: ORDERS_ID,
              native: {
                query: "select * from orders",
              },
              display: "table",
            },
          },
          metadata,
        ),
      );

      const inputEl = screen.getByLabelText("Name");
      await userEvent.click(inputEl);
      await userEvent.tab();

      const alertEl = screen.getByRole("alert");

      expect(inputEl).toHaveAttribute("aria-invalid", "true");
      expect(inputEl).toHaveAttribute("aria-describedby", alertEl.id);
      expect(alertEl).toHaveTextContent("required");
    });

    it("should show humanized validation message for saving a structured query question", async () => {
      await setup(getQuestion());

      const inputEl = screen.getByLabelText("Name");
      await userEvent.click(inputEl);
      await userEvent.clear(inputEl); // remove autogenerated name
      await userEvent.tab();

      const alertEl = screen.getByRole("alert");

      expect(inputEl).toHaveAttribute("aria-invalid", "true");
      expect(inputEl).toHaveAttribute("aria-describedby", alertEl.id);
      expect(alertEl).toHaveTextContent("required");
    });

    it("should not show collection input if saving directly from a dashboard", async () => {
      await setup(
        getQuestion({
          isSaved: true,
          collection_id: FOO_DASH.collection_id,
          dashboard_id: FOO_DASH.id, // <- question already has a dashboard save location
        }),
      );

      // value loads async here where it would already be in memory as the user is navigating
      // through the application so we have to wait for it to unmount from the DOM
      await waitFor(() => {
        expect(
          screen.queryByLabelText(/Where do you want to save this/),
        ).not.toBeInTheDocument();
      });
    });

    it("should show tab input w/ default value if select dashboard has tabs", async () => {
      await setup(
        getQuestion({
          isSaved: true,
          collection_id: FOO_DASH.collection_id,
          dashboard_id: FOO_DASH.id, // <- question already has a dashboard save location
        }),
      );
      expect(
        await screen.findByLabelText(/Which tab should this go on/),
      ).toBeInTheDocument();
      expect(
        await screen.findByLabelText(/Which tab should this go on/),
      ).toHaveValue("Foo Tab 1");
    });

    it("should now show tab input if selected dashboard has no tabs", async () => {
      await setup(
        getQuestion({
          isSaved: true,
          collection_id: BAR_DASH.collection_id,
          dashboard_id: BAR_DASH.id, // <- question already has a dashboard save location
        }),
      );
      await waitFor(() => {
        expect(
          screen.queryByLabelText(/Which tab should this go on/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("overwriting a saved question", () => {
    it("should display original question's name on save mode control", async () => {
      const originalQuestion = getQuestion({
        isSaved: true,
        name: "Beautiful Orders",
      });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      await setup(dirtyQuestion, originalQuestion);

      expect(
        screen.getByText('Replace original question, "Beautiful Orders"'),
      ).toBeInTheDocument();
    });

    it("should call onSave correctly when form is submitted", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onSaveMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onSaveMock.mock.calls[0];
      expect(call.length).toBe(1);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBe(originalQuestion.id());
      expect(newQuestion.displayName()).toBe(originalQuestion.displayName());
      expect(newQuestion.description()).toBe(originalQuestion.description());
      expect(newQuestion.collectionId()).toBe(originalQuestion.collectionId());
    });

    it("should allow switching to 'save as new' and back", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onSaveMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await userEvent.click(
        screen.getByText(/Replace original question, ".*"/),
      );
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onSaveMock.mock.calls[0];
      expect(call.length).toBe(1);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBe(originalQuestion.id());
      expect(newQuestion.displayName()).toBe(originalQuestion.displayName());
      expect(newQuestion.description()).toBe(originalQuestion.description());
      expect(newQuestion.collectionId()).toBe(originalQuestion.collectionId());
    });

    it("should preserve original question's collection id", async () => {
      const originalQuestion = getQuestion({
        isSaved: true,
        collection_id: 5,
      });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onSaveMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledTimes(1);
      });

      const call: Question[] = onSaveMock.mock.calls[0];
      expect(call.length).toBe(1);

      const newQuestion = call[0];
      expect(newQuestion.id()).toBe(originalQuestion.id());
      expect(newQuestion.displayName()).toBe(originalQuestion.displayName());
      expect(newQuestion.description()).toBe(originalQuestion.description());
      expect(newQuestion.collectionId()).toBe(originalQuestion.collectionId());
    });

    it("shouldn't allow to save a question if form is invalid", async () => {
      await setup(getQuestion());

      await userEvent.clear(screen.getByLabelText("Name"));
      await userEvent.clear(screen.getByLabelText("Description"));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      });
    });

    it("shouldn't call onCreate when form is submitted", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      const { onCreateMock } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(onCreateMock).not.toHaveBeenCalled();
      });
    });

    it("should keep 'save as new' form values while switching saving modes", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      await setup(getDirtyQuestion(originalQuestion), originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await fillForm({
        name: "Should not be erased",
        description: "This should not be erased too",
      });
      await userEvent.click(
        screen.getByText(/Replace original question, ".*"/),
      );
      await userEvent.click(screen.getByText("Save as new question"));

      await waitFor(() => {
        expect(screen.getByLabelText("Name")).toHaveValue(
          "Should not be erased",
        );
      });
      expect(screen.getByLabelText("Description")).toHaveValue(
        "This should not be erased too",
      );
    });

    it("should allow to replace a question with a long name (metabase#53042)", async () => {
      const originalQuestion = getQuestion({
        isSaved: true,
        name: "a".repeat(QUESTION_NAME_MAX_LENGTH),
      });
      await setup(getDirtyQuestion(originalQuestion), originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      const input = screen.getByLabelText("Name");

      expect(input).toHaveValue(`${originalQuestion.displayName()} - Modified`);
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

      await userEvent.click(screen.getByText(/Replace original question/));

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("should allow to replace the question if new question form is invalid (metabase#13817)", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      await setup(getDirtyQuestion(originalQuestion), originalQuestion);

      await userEvent.click(screen.getByText("Save as new question"));
      await userEvent.clear(screen.getByLabelText("Name"));
      await userEvent.click(
        screen.getByText(/Replace original question, ".*"/),
      );

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("should not allow overwriting when user does not have curate permission on collection (metabase#20717)", async () => {
      const originalQuestion = getQuestion({
        isSaved: true,
        name: "Beautiful Orders",
        can_write: false,
      });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);
      await setup(dirtyQuestion, originalQuestion);

      expect(
        screen.queryByText("Save as new question"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Replace original question, ".*"/),
      ).not.toBeInTheDocument();
    });

    it("should not render empty content when render happens after question is saved (metabase#45416)", async () => {
      const originalQuestion = getQuestion({ isSaved: true });
      const dirtyQuestion = getDirtyQuestion(originalQuestion);

      const { rerender } = await setup(dirtyQuestion, originalQuestion);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      // simulate slow response and further re-render of the modal
      jest
        .spyOn(qbSelectors, "getIsSavedQuestionChanged")
        .mockReturnValue(false);

      rerender();

      // verify that modal still has content
      expect(screen.getByText(/replace or save as new/i)).toBeInTheDocument();
    });
  });

  it("should call onClose when Cancel button is clicked", async () => {
    const { onCloseMock } = await setup(getQuestion());
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when close icon is clicked", async () => {
    const { onCloseMock } = await setup(getQuestion());
    await userEvent.click(screen.getByLabelText("Close"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  describe("Cache TTL field", () => {
    const question = Question.create({
      metadata,
      dataset_query: {
        type: "query",
        database: SAMPLE_DB_ID,
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["count"]],
        },
      },
    });

    describe("OSS", () => {
      it("is not shown", async () => {
        await setup(question, null);
        expect(screen.queryByText("More options")).not.toBeInTheDocument();
        expect(
          screen.queryByText("Cache all question results for"),
        ).not.toBeInTheDocument();
      });
    });

    describe("EE", () => {
      beforeEach(() => {
        setupEnterpriseTest();
      });

      it("is not shown", async () => {
        await setup(question, null);
        expect(screen.queryByText("More options")).not.toBeInTheDocument();
        expect(
          screen.queryByText("Cache all question results for"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("create new modals", () => {
    const newCollBtn = () =>
      screen.getByRole("button", {
        name: /new collection/i,
      });
    const newCollCancelButton = () =>
      within(screen.getByRole("dialog", { name: /new collection/ })).getByRole(
        "button",
        { name: /cancel/i },
      );
    const selectCollCancelButton = () =>
      within(
        screen.getByRole("dialog", { name: /Select a collection/ }),
      ).getByRole("button", { name: /cancel/i });
    const questionModalTitle = () =>
      screen.getByRole("heading", { name: /new question/i });

    const newDashBtn = () =>
      screen.getByRole("button", {
        name: /new dashboard/i,
      });

    const COLLECTION = {
      USER: BOBBY_TEST_COLLECTION,
      ROOT: createMockCollection({
        ...ROOT_COLLECTION,
        can_write: true,
      }),
      PARENT: createMockCollection({
        id: 2,
        name: "Parent collection",
        can_write: true,
      }),
      CHILD: createMockCollection({
        id: 3,
        name: "Child collection",
        can_write: true,
      }),
    };
    COLLECTION.CHILD.location = `/${COLLECTION.PARENT.id}/`;

    beforeEach(async () => {
      mockGetBoundingClientRect();

      setupCollectionItemsEndpoint({
        collection: COLLECTION.ROOT,
        collectionItems: [
          createMockCollectionItem({
            ...COLLECTION.PARENT,
            id: COLLECTION.PARENT.id as number,
            entity_id: COLLECTION.PARENT.entity_id as BaseEntityId,
            location: COLLECTION.PARENT.location || "/",
            type: undefined,
            model: "collection",
          }),
        ],
      });
      setupCollectionItemsEndpoint({
        collection: COLLECTION.PARENT,
        collectionItems: [
          createMockCollectionItem({
            ...COLLECTION.CHILD,
            id: COLLECTION.CHILD.id as number,
            entity_id: COLLECTION.CHILD.entity_id as BaseEntityId,
            location: COLLECTION.CHILD.location || "/",
            type: undefined,
            model: "collection",
          }),
        ],
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("new collection modal", () => {
      it("should have a new collection button in the collection picker", async () => {
        await setup(getQuestion());
        await userEvent.click(saveLocDropdown());
        await waitFor(() => {
          expect(newCollBtn()).toBeInTheDocument();
        });
      });

      it("should open new collection modal and return to dashboard modal when clicking close", async () => {
        await setup(getQuestion());
        await userEvent.click(saveLocDropdown());
        await waitFor(() => expect(newCollBtn()).toBeInTheDocument());
        await userEvent.click(newCollBtn());
        await screen.findByText("Give it a name");
        await userEvent.click(newCollCancelButton());
        await userEvent.click(selectCollCancelButton());
        await waitFor(() => expect(questionModalTitle()).toBeInTheDocument());
      });

      describe("new collection location", () => {
        beforeEach(async () => {
          await setup(getQuestion(), null, {
            collectionEndpoints: {
              collections: Object.values(COLLECTION),
              rootCollection: COLLECTION.ROOT,
            },
          });
        });

        it("should create collection inside nested folder", async () => {
          await userEvent.click(saveLocDropdown());
          await waitFor(() => expect(newCollBtn()).toBeInTheDocument());
          await userEvent.click(
            await screen.findByRole("link", {
              name: new RegExp(BOBBY_TEST_COLLECTION.name),
            }),
          );
          await userEvent.click(newCollBtn());
          await screen.findByText("Give it a name");
        });

        it("should create collection inside root folder", async () => {
          await userEvent.click(saveLocDropdown());
          await waitFor(() => expect(newCollBtn()).toBeInTheDocument());
          await userEvent.click(newCollBtn());
          await waitFor(async () => {
            expect(
              await screen.findByRole("heading", {
                name: "Create a new collection",
              }),
            ).toBeInTheDocument();
          });
        });
      });
    });

    describe("new dashboard modal", () => {
      it("should have a new dashboard button in the collection picker", async () => {
        await setup(getQuestion());
        await userEvent.click(saveLocDropdown());
        await waitFor(() => {
          expect(newDashBtn()).toBeInTheDocument();
        });
      });

      it("should open new dashboard modal and return to dashboard modal when clicking close", async () => {
        await setup(getQuestion());
        await userEvent.click(saveLocDropdown());
        await waitFor(() => expect(newDashBtn()).toBeInTheDocument());
        await userEvent.click(newDashBtn());
        await screen.findByText("Give it a name");
        await within(
          await screen.findByTestId("create-dashboard-on-the-go"),
        ).findByRole("button", { name: /cancel/i });
        await userEvent.click(selectCollCancelButton());
        await waitFor(() => expect(questionModalTitle()).toBeInTheDocument());
      });

      describe("new dashboard location", () => {
        beforeEach(async () => {
          await setup(getQuestion(), null, {
            collectionEndpoints: {
              collections: Object.values(COLLECTION),
              rootCollection: COLLECTION.ROOT,
            },
          });
        });

        it("should create dashboard inside nested folder", async () => {
          await userEvent.click(saveLocDropdown());
          await waitFor(() => expect(newDashBtn()).toBeInTheDocument());
          await userEvent.click(
            await screen.findByRole("link", {
              name: new RegExp(BOBBY_TEST_COLLECTION.name),
            }),
          );
          await userEvent.click(newDashBtn());
          await screen.findByText("Give it a name");
        });

        it("should create dashboard inside root folder", async () => {
          await userEvent.click(saveLocDropdown());
          await waitFor(() => expect(newDashBtn()).toBeInTheDocument());
          await userEvent.click(newDashBtn());
          await waitFor(async () => {
            expect(
              await screen.findByRole("heading", {
                name: "Create a new dashboard",
              }),
            ).toBeInTheDocument();
          });
        });
      });
    });
  });
});
