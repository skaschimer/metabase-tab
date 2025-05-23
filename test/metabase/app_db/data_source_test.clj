(ns metabase.app-db.data-source-test
  (:require
   [clojure.java.jdbc :as jdbc]
   [clojure.test :refer :all]
   [metabase.app-db.data-source :as mdb.data-source]
   [metabase.config.core :as config]
   [metabase.connection-pool :as connection-pool]
   [metabase.test :as mt]))

(set! *warn-on-reflection* true)

(defn- ->DataSource [s properties]
  (#'mdb.data-source/->DataSource s (some-> (not-empty properties) connection-pool/map->properties)))

(deftest ^:parallel broken-out-details-test
  (testing :postgres
    (is (= (->DataSource
            "jdbc:postgresql://localhost:5432/metabase"
            {"password"                      "1234"
             "ApplicationName"               config/mb-version-and-process-identifier
             "OpenSourceSubProtocolOverride" "true"
             "user"                          "cam"})
           (mdb.data-source/broken-out-details->DataSource :postgres {:host     "localhost"
                                                                      :port     5432
                                                                      :user     "cam"
                                                                      :password "1234"
                                                                      :db       "metabase"})))))

(deftest ^:parallel broken-out-details-test-2
  (testing :azure-managed-identity
    (is (= (->DataSource
            "jdbc:postgresql://localhost:5432/metabase"
            {"ApplicationName"                  config/mb-version-and-process-identifier
             "OpenSourceSubProtocolOverride"    "true"
             "user"                             "cam"
             "azure-managed-identity-client-id" "client ID"})
           (mdb.data-source/broken-out-details->DataSource :postgres {:host                             "localhost"
                                                                      :port                             5432
                                                                      :user                             "cam"
                                                                      :azure-managed-identity-client-id "client ID"
                                                                      :db                               "metabase"})))))

(deftest ^:parallel broken-out-details-test-2b
  (testing :azure-managed-identity
    (testing "password takes precedence"
      (is (= (->DataSource
              "jdbc:postgresql://localhost:5432/metabase"
              {"password"                      "1234"
               "ApplicationName"               config/mb-version-and-process-identifier
               "OpenSourceSubProtocolOverride" "true"
               "user"                          "cam"})
             (mdb.data-source/broken-out-details->DataSource :postgres {:host                             "localhost"
                                                                        :port                             5432
                                                                        :user                             "cam"
                                                                        :password                         "1234"
                                                                        :azure-managed-identity-client-id "client ID"
                                                                        :db                               "metabase"}))))))

(deftest ^:parallel broken-out-details-test-3
  (testing :h2
    (is (= (->DataSource
            "jdbc:h2:file:/metabase/metabase.db"
            nil)
           (mdb.data-source/broken-out-details->DataSource :h2 {:db "file:/metabase/metabase.db"})))))

(deftest ^:parallel broken-out-details-test-4
  (testing :mysql
    (is (= (->DataSource
            "jdbc:mysql://localhost:3306/metabase"
            {"user" "root"})
           (mdb.data-source/broken-out-details->DataSource :mysql {:host "localhost"
                                                                   :port 3306
                                                                   :user "root"
                                                                   :db   "metabase"})))))

(deftest ^:parallel broken-out-details-test-5
  (testing "end-to-end"
    (let [data-source (mdb.data-source/broken-out-details->DataSource
                       :h2
                       {:subprotocol "h2"
                        :db          (format "mem:%s" (mt/random-name))
                        :classname   "org.h2.Driver"})]
      (with-open [conn (.getConnection data-source)]
        (is (= [{:one 1}]
               (jdbc/query {:connection conn} "SELECT 1 AS one;")))))))

(deftest ^:parallel connection-string-test
  (let [data-source (mdb.data-source/raw-connection-string->DataSource
                     (format "jdbc:h2:mem:%s" (mt/random-name)))]
    (with-open [conn (.getConnection data-source)]
      (is (= [{:one 1}]
             (jdbc/query {:connection conn} "SELECT 1 AS one;"))))))

(deftest ^:parallel connection-string-test-2
  (testing "Without jdbc: at the beginning"
    (let [db-name     (mt/random-name)
          data-source (mdb.data-source/raw-connection-string->DataSource
                       (format "h2:mem:%s" db-name))]
      (is (= (mdb.data-source/raw-connection-string->DataSource (str "jdbc:h2:mem:" db-name))
             data-source))
      (with-open [conn (.getConnection data-source)]
        (is (= [{:one 1}]
               (jdbc/query {:connection conn} "SELECT 1 AS one;")))))))

(deftest ^:parallel connection-string-test-3
  (testing "Accept `postgres` as a subprotocol (I think Heroku or whatever does this to screw with us)"
    (is (= (mdb.data-source/raw-connection-string->DataSource "jdbc:postgresql://localhost:5432/metabase")
           (mdb.data-source/raw-connection-string->DataSource "postgres://localhost:5432/metabase")))))

(deftest ^:parallel wonky-connection-string-test
  (testing "Should handle malformed user:password@host:port strings (#14678, #20121)"
    (doseq [subprotocol ["postgresql" "mysql"]]
      (testing "user AND password"
        (is (= (->DataSource
                (str "jdbc:" subprotocol "://localhost:5432/metabase")
                {"user" "cam", "password" "1234"})
               (mdb.data-source/raw-connection-string->DataSource (str subprotocol "://cam:1234@localhost:5432/metabase"))))
        (testing "no port"
          (is (= (->DataSource
                  (str "jdbc:" subprotocol "://localhost/metabase")
                  {"user" "cam", "password" "1234"})
                 (mdb.data-source/raw-connection-string->DataSource (str subprotocol "://cam:1234@localhost/metabase"))))))
      (testing "user only"
        (is (= (->DataSource
                (str "jdbc:" subprotocol "://localhost:5432/metabase?password=1234")
                {"user" "cam"})
               (mdb.data-source/raw-connection-string->DataSource (str subprotocol "://cam@localhost:5432/metabase?password=1234"))))
        (testing "no port"
          (is (= (->DataSource
                  (str "jdbc:" subprotocol "://localhost/metabase?password=1234")
                  {"user" "cam"})
                 (mdb.data-source/raw-connection-string->DataSource (str subprotocol "://cam@localhost/metabase?password=1234")))))))))

(deftest ^:parallel raw-connection-string-with-separate-username-and-password-test
  (testing "Raw connection string should support separate username and/or password (#20122)"
    (testing "username and password"
      (is (= (->DataSource
              "jdbc:postgresql://metabase"
              {"user" "cam", "password" "1234"})
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" "1234" nil)
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" "1234" "client ID"))))))

(deftest ^:parallel raw-connection-string-with-separate-username-and-password-test-2
  (testing "Raw connection string should support separate username and/or password (#20122)"
    (testing "username only"
      (is (= (->DataSource
              "jdbc:postgresql://metabase"
              {"user" "cam"})
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" nil nil)
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" "" nil))))))

(deftest ^:parallel raw-connection-string-with-separate-username-and-password-test-3
  (testing "Raw connection string should support separate username and/or password (#20122)"
    (testing "username and azure-managed-identity-client-id"
      (is (= (->DataSource
              "jdbc:postgresql://metabase"
              {"user" "cam"
               "azure-managed-identity-client-id" "client ID"})
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" nil "client ID")
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "cam" "" "client ID"))))))

(deftest ^:parallel raw-connection-string-with-separate-username-and-password-test-4
  (testing "Raw connection string should support separate username and/or password (#20122)"
    (testing "password only"
      (is (= (->DataSource
              "jdbc:postgresql://metabase"
              {"password" "1234"})
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" nil "1234" nil)
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "" "1234" nil)
             (mdb.data-source/raw-connection-string->DataSource "postgres://metabase" "" "1234" "client ID"))))))

(deftest ^:parallel equality-test
  (testing "Two DataSources with the same URL should be equal"
    (is (= (mdb.data-source/raw-connection-string->DataSource "ABCD")
           (mdb.data-source/raw-connection-string->DataSource "ABCD")))))

(deftest ^:parallel equality-test-2
  (testing "Two DataSources with the same URL and properties should be equal"
    (is (= (mdb.data-source/broken-out-details->DataSource :h2 {:db "wow", :x 1})
           (mdb.data-source/broken-out-details->DataSource :h2 {:db "wow", :x 1})))))
