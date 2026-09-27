import {productionStore} from '../lib/store.mjs';
const store=productionStore(process.env.DATABASE_URL);try{await store.migrate();console.log('Đã tạo/cập nhật bảng; không xóa dữ liệu cũ.');}finally{await store.pool.end();}

