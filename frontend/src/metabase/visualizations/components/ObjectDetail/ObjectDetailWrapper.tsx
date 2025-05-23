import { useState } from "react";

import Question from "metabase-lib/v1/Question";

import { PaginationFooter } from "../PaginationFooter/PaginationFooter";

import { ObjectDetailView } from "./ObjectDetailView";
import S from "./ObjectDetailWrapper.module.css";
import { RootModal } from "./ObjectDetailWrapper.styled";
import type { ObjectDetailProps } from "./types";

export function ObjectDetailWrapper({
  question,
  isDataApp,
  data,
  closeObjectDetail,
  card,
  dashcard,
  isObjectDetail,
  ...rest
}: ObjectDetailProps) {
  const [currentObjectIndex, setCurrentObjectIndex] = useState(0);

  // only show modal if this object detail was triggered via an object detail zoom action
  const shouldShowModal = isObjectDetail;
  const getFallbackQuestion = () =>
    card && rest.metadata ? new Question(card, rest.metadata) : undefined;

  if (shouldShowModal) {
    return (
      <RootModal
        isOpen
        onClose={closeObjectDetail}
        className="" // need an empty className to override the Modal default width
      >
        <ObjectDetailView
          {...rest}
          showHeader
          data={data}
          question={question ?? getFallbackQuestion()}
          closeObjectDetail={closeObjectDetail}
        />
      </RootModal>
    );
  }

  const hasPagination = data?.rows?.length > 1;

  return (
    <>
      <ObjectDetailView
        {...rest}
        zoomedRow={data.rows[currentObjectIndex]}
        data={data}
        question={question ?? getFallbackQuestion()}
        showHeader={rest.settings["detail.showHeader"]}
        showControls={false}
        showRelations={false}
        closeObjectDetail={closeObjectDetail}
        isDataApp={isDataApp}
      />
      {hasPagination && (
        <PaginationFooter
          className={S.pagination}
          data-testid="pagination-footer"
          start={currentObjectIndex}
          end={currentObjectIndex}
          total={data.rows.length}
          onNextPage={() => setCurrentObjectIndex((prev) => prev + 1)}
          onPreviousPage={() => setCurrentObjectIndex((prev) => prev - 1)}
          singleItem
        />
      )}
    </>
  );
}
