import express from "express";
import { io } from "socket.io-client";
import escpos from "escpos";
import escposUSB from "escpos-usb";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 8000;

escpos.USB = escposUSB;

// Connect to cloud server
const socket = io(`${process.env.SOCKET_WEB_URL}/receipt`);

socket.on("connect", () => {
  console.log("Connected to web server:", socket.id);
});

socket.on("printReceipt", async (data) => {
  try {
    const { items, order } = data;
    const device = new escpos.USB(0x0FE6, 0x811E); 
    const printer = new escpos.Printer(device);

    device.open(async (err) => {
      if (err) {
        console.error("Printer open error:", err);
        socket.emit("print-status", { success: false, error: err.message });
        return;
      }

      // --- Header ---
      printer
        .font("A")
        .align("CT")
        .style("B")
        .size(0, 0)
        .text("RM Collections")
        .style("NORMAL")
        .size(0, 0)
        .text("11 Luzon St., South Signal Village")
        .text("Taguig City")
        .text(new Date().toLocaleString())
        .text("--------------------------------");

      // --- Order Info ---
      printer.align("LT").font("A").size(0, 0);
      printer.text(`Order: ${order.order_id}`);
      printer.text(`Cashier: ${order.cashier.firstname} ${order.cashier.lastname}`);
      printer.text(`Payment: ${order.paymentMethod.toUpperCase()}`);
      printer.text("--------------------------------");

      // --- Table Header ---
      const headerQty = "Qty".padEnd(5, " ");
      const headerPrice = "Price".padStart(8, " ");
      const headerDisc = "Disc.".padStart(8, " ");
      const headerTotal = "Total".padStart(8, " ");
      printer.text(`${headerQty}${headerPrice} ${headerDisc}${headerTotal}`);
      printer.text("--------------------------------");

      // --- Items ---
      let totalDiscount = 0;
      items.forEach((item) => {
        const discount = item.discount || 0;
        const attributes = Object.entries(item.attributes || {});
        let attrs = "";
        if (attributes.length > 0) {
          attrs = attributes.map(([_, value]) => `${value.trim()}`).join(" - ");
        }
        const name = `${item.name}${attributes.length > 0 ? ` (${attrs})` : ""}`;
        const qty = `x${item.quantity}`.padEnd(5, " ");
        const price = item.price.toFixed(2);
        const discountAmount = (item.lineTotal * (discount / 100));
        const discountedTotal = (item.lineTotal - discountAmount).toFixed(2);

        totalDiscount += discountAmount;

        printer.text(`${name}`);
        if (discount > 0) {
          const priceStr = price.padStart(8, " ");
          const discountStr = `${discount}%`.padStart(8, " ");
          const totalStr = discountedTotal.padStart(8, " ");
          printer.text(`${qty}${priceStr}${discountStr}${totalStr}`);
        } else {
          const priceStr = price.padStart(8, " ");
          const totalStr = discountedTotal.padStart(8, " ");
          printer.text(`${qty}${priceStr}        ${totalStr}`);
        }
      });

      // --- Totals & Payment ---
      printer.text("--------------------------------");
      printer.align("LT").style("B");

      const subtotalBeforeDiscount = order.total + totalDiscount;

      printer.text(`Subtotal: ${subtotalBeforeDiscount.toFixed(2)}`);
      if (totalDiscount > 0) {
        printer.text(`Discount: -${totalDiscount.toFixed(2)}`);
      }
      printer.text(`Total:    ${order.total.toFixed(2)}`);
      printer.text(`Payment:  ${order.paymentAmount.toFixed(2)}`);
      printer.text(`Change:   ${order.change.toFixed(2)}`);
      printer.text("--------------------------------");

      // --- Footer ---
      printer.align("CT").style("NORMAL");
      printer.text("Thank you for shopping!");
      printer.text("RM Collections");
      printer.text("--------------------------------");
      printer.feed(2);

      // Cut paper & close connection
      printer.cut();
      printer.close();

      socket.emit("print-status", { success: true });
    });
  } catch (err) {
    console.error("Receipt print error:", err);
    socket.emit("print-status", { success: false, error: err.message });
  }
});


app.get("/", (req, res) => {
  res.send("Printer client running and connected to cloud.");
});

app.listen(PORT, () => {
  console.log(`Local client server running on http://localhost:${PORT}`);
});
