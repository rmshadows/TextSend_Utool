/**
 * 定义列表类
 * https://gitee.com/mvc_ydb/data-structure/blob/master/list.js#
 * https://sabe.io/blog/node-syntaxerror-cannot-use-import-statement-outside-a-module
 * https://www.tutorialsandyou.com/javascript/how-to-import-a-class-from-another-file-in-javascript-148.html
 */
class JsList {
    constructor() {
        // 定义列表的元素个数
        this.listSize = 0;
        // 列表的位置指针
        this.pos = 0;
        // 列表的数据存储
        this.dataSource = [];
    }

    // 设置列表 
    setDataSource(list) {
        // 定义列表的元素个数
        this.listSize = list.length;
        // 列表的位置指针
        this.pos = 0;
        // 列表的数据存储
        this.dataSource = list;
    }

    // append: 列表增加元素
    append(element) {
        this.dataSource[this.listSize++] = element;
    }

    // remove: 列表中删除元素
    remove(element) {
        var findAt = this.find(element);
        if (findAt > -1) {
            this.dataSource.splice(findAt, 1);
            --this.listSize;
            return true;
        }
        return false;
    }

    // find：辅助方法，用于查找要操作的元素
    find(element) {
        for (var i = 0; i < this.listSize; i++) {
            if (this.dataSource[i] === element) {
                return i;
            }
        }
        return -1;
    }

    // length：返回列表中的元素个数
    length() {
        return this.listSize;
    }

    // toString: 返回列表的字符串形式
    toString() {
        return this.dataSource.toString();
    }

    // insert: 向列表中添加一个元素
    insert(element, after) {
        var insertPos = this.find(after);
        if (insertPos > -1) {
            this.dataSource.splice(insertPos + 1, 0, element);
            ++this.listSize;
            return true;
        }
        return false;
    }

    // clear: 清空列表中的元素
    clear() {
        this.dataSource.length = 0;
        this.listSize = this.pos = 0;
    }

    // front：指针归零(移动到列表的第一个元素的位置)
    front() {
        this.pos = 0;
    }
    // end: 指针移动到列表的最后一个元素的位置
    end() {
        this.pos = this.listSize - 1;
    }
    // hasPrev: 判断指针是否可以向前移动
    hasPrev() {
        return this.pos > 0
    }
    // hasNext: 判断指针是否可以向后移动
    hasNext() {
        return this.pos < this.listSize - 1
    }
    // moveTo: 修改指针的位置
    moveTo(position) {
        if (0 <= position && position <= this.listSize - 1) {
            this.pos = position;
        }
    }
    // prev: 指针向前移动一位
    prev() {
        if (this.hasPrev()) {
            --this.pos;
        }
    }
    // next: 指针向后移动一位
    next() {
        if (this.hasNext()) {
            ++this.pos;
        }
    }
    // getElement: 获取列表中指针所对应的元素
    getElement() {
        return this.dataSource[this.pos];
    }
    // currPos： 返回当前指针位置
    currPos() {
        return this.pos;
    }
    // 遍历
    print(){
        this.dataSource.forEach(e=>{
            console.log(e);
        });
    };
    // 转为列表
    getList(){
        return this.dataSource;
    }
}

// module.exports = {
//     JsList
// }
