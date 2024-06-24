const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const moment = require("moment-timezone");

const app = express();
const port = 4000;

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// MySQL database connection configuration
const db = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "hcf_delivery",
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.log("Error connecting database.", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Enable CORS
app.use(cors());

app.get("/get-trucks", (req, res) => {
  try {
    db.query("select * from trucks", (err, result) => {
      if (err) {
        return res.status(500).json({ msg: "Could not retrieve trucks." });
      }
      return res.status(200).json({ msg: "Success", resultData: result });
    });
  } catch (error) {
    return res.status(500).json({ msg: "Internal server error." });
  }
});

app.get("/get-routes/:term?", (req, res) => {
  const term = req.params.term;
  let queryParams = [];

  let query = "";
  if (term) {
    query = `
     SELECT * FROM orders
    WHERE 
    order_status > 0 AND
    (CAST(id AS CHAR) = ? OR 
    DATE_FORMAT(order_created_date, '%Y-%m-%d') = ? OR 
    truck_id = ?);
   `;
    queryParams = [term, term, term];
  } else query = "SELECT * FROM orders WHERE order_status NOT IN (0)";

  console.log("query ", query, term, "term");
  try {
    db.query(query, queryParams, (err, result) => {
      if (err) {
        return res.status(500).json({ msg: "Could not retrieve routes." });
      }
      return res.status(200).json({ msg: "Success", resultData: result });
    });
  } catch (error) {
    return res.status(500).json({ msg: "Internal server error." });
  }
});

// API endpoint to add a new truck
app.post("/add-truck", (req, res) => {
  const { truck_id, truck_type, shift } = req.body;
  try {
    // Insert into MySQL database
    const sql =
      "INSERT INTO trucks (truck_id, truck_type, shift) VALUES (?, ?, ?)";
    db.query(sql, [truck_id, truck_type, shift], (err, result) => {
      if (err) {
        console.error("Error adding truck:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ msg: "Truck already exists." });
        }
        return res.status(500).json({ msg: "Failed to add truck" });
      }
      console.log("Number of trucks added: " + result.affectedRows);
      return res.status(200).json({ msg: "Truck added successfully" });
    });
  } catch (error) {
    console.log;
    return res.status(500).json({ msg: "Internal server error." });
  }
});

//delete truck
app.delete("/delete-truck/:truck_id", async (req, res) => {
  const id = req.params.truck_id;
  try {
    db.query("delete from trucks where truck_id=?", id, (err, result) => {
      if (err) {
        return res.status(500).json({ msg: "Error deleting truck." });
      }
      return res.status(200).json({ msg: "Truck successfully deleted." });
    });
  } catch (error) {
    console.log("error deleting truck.");
  }
});

// API endpoint to update truck
app.post("/update-truck", (req, res) => {
  const { truck_id, truck_type, shift } = req.body;
  try {
    // Insert into MySQL database
    const sql =
      "Update trucks set truck_type = ? ,shift = ? where truck_id = ?";
    db.query(sql, [truck_type, shift, truck_id], (err, result) => {
      if (err) {
        console.error("Error updating truck:", err);
        return res.status(500).json({ msg: "Failed to update truck." });
      }
      return res.status(200).json({ msg: "Truck updated successfully." });
    });
  } catch (error) {
    return res.status(500).json({ msg: "Internal server error." });
  }
});

// Handle file upload route
app.post("/upload-orders", (req, res) => {
  const records = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ msg: "Invalid input data." });
  }

  const values = records.map((record) => [
    record.order_date
      ? moment(record.order_date).format("YYYY-MM-DD")
      : moment.tz("Asia/Yangon").format("YYYY-MM-DD"),
    record.name,
    record.phone_number,
    record.address,
    record.items,
    record.price,
    record.delivery_fee,
    record.order_type,
    record.order_priority,
    record.prefer_time,
    record.prefer_shift,
  ]);

  const deleteQuery = "DELETE FROM orders WHERE order_created_date = ?";
  const insertQuery =
    "INSERT INTO orders (order_created_date, name, phone_number, address, items, price, delivery_fee, order_type, order_priority, prefer_time, prefer_shift) VALUES ?";
  const selectQuery =
    "SELECT * FROM orders WHERE order_created_date = ? ORDER BY order_priority DESC";

  db.query(deleteQuery, [values[0][0]], (err, deleteResult) => {
    if (err) {
      console.error("Error deleting records:", err);
      return res
        .status(500)
        .json({ msg: "Failed to delete existing records." });
    }

    console.log(
      `Deleted ${deleteResult.affectedRows} existing records for date ${values[0][0]}.`
    );

    db.query(insertQuery, [values], (err, result) => {
      if (err) {
        console.error("Error inserting records:", err);
        return res.status(500).json({ msg: "Failed to insert records." });
      }

      const insertedLength = result.affectedRows;

      db.query(selectQuery, [values[0][0]], (err, recordsData) => {
        if (err) {
          console.error("Error retrieving records:", err);
          return res
            .status(500)
            .json({ msg: "Failed to retrieve inserted data." });
        }

        res.status(200).json({
          msg: `Number of records inserted: ${insertedLength}`,
          resultData: recordsData,
        });
      });
    });
  });
});

// // Handle file upload route
// app.post("/upload-orders", (req, res) => {
//   let insertedLength = 0;
//   try {
//     const records = req.body;
//     console.log("Rescord length ", records.length);

//     if (!records || !Array.isArray(records) || records.length === 0) {
//       return res.status(400).json({ msg: "Invalid input data." });
//     }

//     const sql =
//       "INSERT INTO orders (order_created_date, name, phone_number, address, items, price, delivery_fee, order_type, order_priority, prefer_time, prefer_shift) VALUES ?";
//     const values = records.map((record) => [
//       record.order_date
//         ? moment(record.order_date).format("YYYY-MM-DD")
//         : moment.tz("Asia/Yangon").format("YYYY-MM-DD"),
//       record.name,
//       record.phone_number,
//       record.address,
//       record.items,
//       record.price,
//       record.delivery_fee,
//       record.order_type,
//       record.order_priority,
//       record.prefer_time,
//       record.prefer_shift,
//     ]);
//     // Delete records with same date data
//     const deleteQuery = "DELETE FROM orders WHERE order_created_date = ?";
//     db.query(deleteQuery, [values[0][0]], (err, deleteResult) => {
//       if (err) {
//         console.error("Error deleting records:", err);
//         return res
//           .status(500)
//           .json({ msg: "Failed to delete existing records." });
//       }

//       console.log(
//         `Deleted ${deleteResult.affectedRows} existing records for date ${values[0][0]}.`
//       );
//     });

//     //insert order data
//     db.query(sql, [values], (err, result) => {
//       if (err) {
//         console.error(err);
//         return res
//           .status(500)
//           .json({ msg: "Failed to insert! " + err.message });
//       }
//       insertedLength = result.affectedRows;
//     });

//     db.query(
//       "select * from orders where order_created_date=? ORDER BY order_priority DESC;",
//       values[0][0],
//       (errRetrieve, recordsData) => {
//         if (errRetrieve) {
//           return res
//             .status(500)
//             .json({ msg: "Failed to recive inserted data! " + err.message });
//         }
//         return res.status(200).json({
//           msg: "Number of records inserted: " + insertedLength,
//           resultData: recordsData,
//         });
//       }
//     );
//   } catch (error) {
//     console.log("Error : ", error);

//     return res.status(500).json({ msg: `Error ${error}` });
//   }
// });

app.post("/update-routes", (req, res) => {
  const { id, order_status } = req.body;
  db.query(
    "update orders set order_status = ? where id=?",
    [order_status, id],
    (err, result) => {
      if (err) res.status(500).json({ msg: "Error updating order status." });
      else res.status(200).json({ msg: "Status successfully updated." });
    }
  );
});
app.post("/plan-hala-route", (req, res) => {
  db.query("select * from trucks where truck_type='1'", (selectErr, trucks) => {
    if (trucks && trucks.length > 0) {
      let truck_count = trucks.length ?? 0;
      let order_count = 0;
      console.log(trucks, "trucks ", truck_count, "truck count ");
      db.query(
        "SELECT COUNT(*) AS total_orders FROM orders WHERE order_status = '0' AND order_type = '1'",
        (err, result) => {
          order_count = result[0].total_orders;
          if (order_count === 0) {
            return res
              .status(404)
              .json({ msg: "All hala orders already planned." });
          }
          let order_per_truck = Math.floor(order_count / truck_count);

          for (i = 0; i < truck_count; i++) {
            let limit = "";

            if (i !== truck_count - 1) {
              limit = "LIMIT " + order_per_truck;
            }
            db.query(
              "UPDATE orders SET truck_id = ?, order_status = 1 WHERE order_status=0 and order_type=1 " +
                limit,
              [trucks[i].truck_id],
              (error, updated) => {
                if (!error) {
                  return res.status(200).json({
                    msg: "Successfully planned hala route :" + order_count,
                  });
                }
              }
            );
          }
        }
      );
    } else {
      return res.status(404).json({ msg: "There is no truck to plan route." });
    }
  });
});

app.post("/plan-non-hala-route", (req, res) => {
  db.query("SELECT * FROM trucks WHERE truck_type='0'", (selectErr, trucks) => {
    if (selectErr) {
      return res.status(500).json({ msg: "Database error" });
    }

    if (trucks && trucks.length > 0) {
      let truck_count = trucks.length;
      let order_count = 0;

      db.query(
        "SELECT COUNT(*) AS total_orders FROM orders WHERE order_status = '0' AND order_type = '0'",
        (err, result) => {
          if (err) {
            return res.status(500).json({ msg: "Database error" });
          }

          order_count = result[0].total_orders;

          if (order_count === 0) {
            return res
              .status(404)
              .json({ msg: "All non-hala orders already planned." });
          }

          let order_per_truck = Math.floor(order_count / truck_count);
          let promises = [];

          for (let i = 0; i < truck_count; i++) {
            let limit = i !== truck_count - 1 ? `LIMIT ${order_per_truck}` : "";

            let promise = new Promise((resolve, reject) => {
              db.query(
                "UPDATE orders SET truck_id = ?, order_status = 1 WHERE order_status = 0 AND order_type = 0 " +
                  limit,
                [trucks[i].truck_id],
                (error, updated) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(updated);
                  }
                }
              );
            });

            promises.push(promise);
          }

          Promise.all(promises)
            .then(() => {
              res.status(200).json({
                msg: `Successfully planned non-hala route: ${order_count}`,
              });
            })
            .catch((error) => {
              console.error("Error updating orders:", error);
              res.status(500).json({ msg: "Error updating orders" });
            });
        }
      );
    } else {
      return res
        .status(404)
        .json({ msg: "There are no trucks available to plan." });
    }
  });
});

// app.post("/plan-non-hala-route", (req, res) => {
//   db.query("select * from trucks where truck_type='0'", (selectErr, trucks) => {
//     if (trucks && trucks.length > 0) {
//       let truck_count = trucks.length ?? 0;
//       let order_count = 0;
//       db.query(
//         "SELECT COUNT(*) AS total_orders FROM orders WHERE order_status = '0' AND order_type = '0'",
//         (err, result) => {
//           order_count = result[0].total_orders;
//           if (order_count === 0) {
//             return res.status(404).json({
//               msg: "All non-hala orders already planned.",
//             });
//           }
//           let order_per_truck = Math.floor(order_count / truck_count);

//           for (i = 0; i < truck_count; i++) {
//             let limit = "";

//             if (i !== truck_count - 1) {
//               limit = "LIMIT " + order_per_truck;
//             }
//             db.query(
//               "UPDATE orders SET truck_id = ?, order_status = 1 WHERE order_status=0 and order_type=0 " +
//                 limit,
//               [trucks[i].truck_id],
//               (error, updated) => {
//                 if (!error) {
//                   return res.status(200).json({
//                     msg: "Successfully planned non-hala route :" + order_count,
//                   });
//                 }
//               }
//             );
//           }
//         }
//       );
//     } else {
//       return res.status(404).json({ msg: "There is no truck to plan." });
//     }
//   });
// });

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
